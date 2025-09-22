import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import multer from "multer";
import { storage } from "./storage";
import { plcConfigSchema, mockNodeData } from "@shared/schema";
import { z } from "zod";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // PLC Management Routes
  app.get("/api/plcs", async (req, res) => {
    try {
      const plcs = await storage.getAllPLCs();
      res.json(plcs);
    } catch (error) {
      console.error("Error fetching PLCs:", error);
      res.status(500).json({ error: "Failed to fetch PLCs" });
    }
  });

  app.get("/api/plcs/:id", async (req, res) => {
    try {
      const plc = await storage.getPLCById(req.params.id);
      if (!plc) {
        return res.status(404).json({ error: "PLC not found" });
      }
      res.json(plc);
    } catch (error) {
      console.error("Error fetching PLC:", error);
      res.status(500).json({ error: "Failed to fetch PLC" });
    }
  });

  app.post("/api/plcs", async (req, res) => {
    try {
      const config = plcConfigSchema.parse(req.body);
      const plc = await storage.createPLC(config);
      res.status(201).json(plc);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("PLC validation error:", error.errors);
        return res.status(400).json({ error: "Invalid PLC configuration", details: error.errors });
      }
      console.error("Error creating PLC:", error);
      res.status(500).json({ error: "Failed to create PLC" });
    }
  });

  app.put("/api/plcs/:id", async (req, res) => {
    try {
      const updates = req.body;
      const plc = await storage.updatePLC(req.params.id, updates);
      if (!plc) {
        return res.status(404).json({ error: "PLC not found" });
      }
      res.json(plc);
    } catch (error) {
      console.error("Error updating PLC:", error);
      res.status(500).json({ error: "Failed to update PLC" });
    }
  });

  app.delete("/api/plcs/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePLC(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "PLC not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting PLC:", error);
      res.status(500).json({ error: "Failed to delete PLC" });
    }
  });

  // PLC Connection Management
  app.post("/api/plcs/:id/connect", async (req, res) => {
    try {
      const plc = await storage.updatePLC(req.params.id, {
        is_connected: true,
        status: "active",
        last_checked: new Date(),
      });
      if (!plc) {
        return res.status(404).json({ error: "PLC not found" });
      }
      res.json(plc);
    } catch (error) {
      console.error("Error connecting PLC:", error);
      res.status(500).json({ error: "Failed to connect PLC" });
    }
  });

  app.post("/api/plcs/:id/disconnect", async (req, res) => {
    try {
      const plc = await storage.updatePLC(req.params.id, {
        is_connected: false,
        status: "maintenance",
        last_checked: new Date(),
      });
      if (!plc) {
        return res.status(404).json({ error: "PLC not found" });
      }
      res.json(plc);
    } catch (error) {
      console.error("Error disconnecting PLC:", error);
      res.status(500).json({ error: "Failed to disconnect PLC" });
    }
  });

  // Node Data Routes
  app.get("/api/plcs/:id/data", async (req, res) => {
    try {
      const data = await storage.getNodeData(req.params.id);
      res.json(data);
    } catch (error) {
      console.error("Error fetching node data:", error);
      res.status(500).json({ error: "Failed to fetch node data" });
    }
  });

  // JSON Upload Route
  app.post("/api/upload/json", upload.single("jsonFile"), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileContent = req.file.buffer.toString("utf-8");
      const json = JSON.parse(fileContent);
      const config = plcConfigSchema.parse(json);
      
      res.json({ success: true, config });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid JSON configuration", details: error.errors });
      }
      if (error instanceof SyntaxError) {
        return res.status(400).json({ error: "Invalid JSON format" });
      }
      console.error("Error processing upload:", error);
      res.status(500).json({ error: "Failed to process file" });
    }
  });

  // Server Status Routes
  app.get("/api/servers/status", async (req, res) => {
    try {
      const statuses = await storage.getServerStatuses();
      res.json(statuses);
    } catch (error) {
      console.error("Error fetching server statuses:", error);
      res.status(500).json({ error: "Failed to fetch server statuses" });
    }
  });

  // Data Export Route
  app.get("/api/export/csv", async (req, res) => {
    try {
      const { plcId } = req.query;
      let data = mockNodeData;
      
      if (plcId && typeof plcId === 'string') {
        data = await storage.getNodeData(plcId);
      }

      // Generate CSV content
      const headers = ["Node Name", "Node ID", "Current Value", "Data Type", "Quality", "Timestamp"];
      const csvRows = [
        headers.join(","),
        ...data.map(item => [
          item.node_name,
          item.node_id,
          item.current_value,
          item.data_type || "",
          item.quality || "",
          item.timestamp.toISOString(),
        ].join(","))
      ];

      const csvContent = csvRows.join("\n");
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="node_data_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  const httpServer = createServer(app);

  // Set up Socket.IO for real-time updates
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Send initial data
    socket.emit("plcs", []);
    socket.emit("nodeData", mockNodeData);

    // Handle PLC subscription
    socket.on("subscribePLC", (plcId) => {
      console.log(`Client ${socket.id} subscribed to PLC ${plcId}`);
      socket.join(`plc-${plcId}`);
    });

    socket.on("unsubscribePLC", (plcId) => {
      console.log(`Client ${socket.id} unsubscribed from PLC ${plcId}`);
      socket.leave(`plc-${plcId}`);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  // Simulate real-time data updates
  setInterval(() => {
    const updatedData = mockNodeData.map(item => ({
      ...item,
      current_value: typeof item.current_value === 'number' 
        ? item.current_value + (Math.random() - 0.5) * 5
        : item.current_value,
      timestamp: new Date(),
    }));

    io.emit("nodeDataUpdate", updatedData);
  }, 1000); // Update every second

  return httpServer;
}
