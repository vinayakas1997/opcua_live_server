import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import multer from "multer";
import { storage } from "./storage";
import { plcConfigSchema, mockNodeData, opcuaNodeSchema, createOpcuaNodeSchema, updateOpcuaNodeSchema } from "@shared/schema";
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

      // Check for duplication by plc_ip and opcua_url
      const existingPLC = await storage.getPLCByIpAndUrl(config.plc_ip, config.opcua_url);
      if (existingPLC) {
        console.log("⚠️ Duplicate PLC detected by IP and URL:", config.plc_ip);
        return res.status(409).json({
          error: "PLC already exists",
          message: `PLC with IP ${config.plc_ip} and OPC UA URL ${config.opcua_url} already exists.`,
          existing_plc: existingPLC,
          action_required: "use_different_ip_or_url"
        });
      }

      const plc = await storage.createPLC(config);
      res.status(201).json(plc);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("PLC validation error:", error.errors);
        return res.status(400).json({ error: "Invalid PLC configuration", details: error.errors });
      }
      if (error instanceof Error && error.message.includes("already exists")) {
        return res.status(409).json({ error: error.message });
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
      // Also delete associated nodes if any (find by plc_no)
      const plc = await storage.getPLCById(req.params.id);
      if (plc && plc.plc_no) {
        const nodes = await storage.getOpcuaNodesByPlcNo(plc.plc_no);
        for (const node of nodes) {
          if (node.id) {
            await storage.deleteOpcuaNode(node.id);
          }
        }
        console.log(`🗑️ Deleted ${nodes.length} nodes for PLC ${req.params.id}`);
      }

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

  // Delete PLC by plc_no and all associated nodes
  app.delete("/api/plcs/by-number/:plc_no", async (req, res) => {
    try {
      const plcNo = parseInt(req.params.plc_no);
      if (isNaN(plcNo)) {
        return res.status(400).json({ error: "Invalid PLC number" });
      }

      console.log("🗑️ Deleting PLC No:", plcNo, "and all associated nodes");
      
      // Get all nodes for this PLC first to count them
      const existingNodes = await storage.getOpcuaNodesByPlcNo(plcNo);
      
      if (existingNodes.length === 0) {
        console.log("⚠️ No nodes found for PLC No:", plcNo);
        // Still check and delete PLC if exists
        const plcDeleted = await storage.deletePLCByPlcNo(plcNo);
        if (!plcDeleted) {
          return res.status(404).json({ error: "PLC not found" });
        }
        return res.json({
          success: true,
          message: `Successfully deleted PLC No. ${plcNo} (no nodes)`,
          plc_no: plcNo,
          deleted_nodes_count: 0
        });
      }

      console.log("📊 Found", existingNodes.length, "nodes to delete for PLC No:", plcNo);

      // Delete all nodes for this PLC
      let deletedCount = 0;
      for (const node of existingNodes) {
        if (node.id) {
          const deleted = await storage.deleteOpcuaNode(node.id);
          if (deleted) {
            deletedCount++;
            console.log("✅ Deleted node ID:", node.id, "- Name:", node.nodeName);
          }
        }
      }

      // Delete the PLC entry
      const plcDeleted = await storage.deletePLCByPlcNo(plcNo);
      if (!plcDeleted) {
        console.warn("⚠️ PLC entry not found for deletion after nodes");
      }

      console.log("🎉 Successfully deleted", deletedCount, "nodes and PLC for No:", plcNo);

      res.json({
        success: true,
        message: `Successfully deleted PLC No. ${plcNo} and all ${deletedCount} associated nodes`,
        plc_no: plcNo,
        deleted_nodes_count: deletedCount,
        plc_deleted: plcDeleted
      });

    } catch (error) {
      console.error("❌ Error deleting PLC and nodes:", error);
      res.status(500).json({ error: "Failed to delete PLC and associated nodes" });
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

  // JSON Upload Route - Creates database entries from uploaded JSON
  app.post("/api/upload/json", upload.single("jsonFile"), async (req, res) => {
    try {
      console.log("📁 JSON Upload started - File received");
      
      if (!req.file) {
        console.log("❌ No file uploaded");
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileContent = req.file.buffer.toString("utf-8");
      console.log("📄 File content length:", fileContent.length);
      
      const json = JSON.parse(fileContent);
      console.log("✅ JSON parsed successfully");
      
      // Validate JSON structure
      if (!json.plcs || !Array.isArray(json.plcs)) {
        console.log("❌ Invalid JSON structure: missing 'plcs' array");
        return res.status(400).json({ error: "Invalid JSON structure: missing 'plcs' array" });
      }

      console.log("🏭 Found", json.plcs.length, "PLCs in JSON");

      // Check for duplicate PLC by IP and URL before processing
      for (const plc of json.plcs) {
        console.log("🔍 Checking for duplicate PLC by IP:", plc.plc_ip, "and URL:", plc.opcua_url);
        const existingPLC = await storage.getPLCByIpAndUrl(plc.plc_ip, plc.opcua_url);
        
        if (existingPLC) {
          console.log("⚠️ Duplicate PLC found by IP and URL!");
          
          // Also check nodes for this plc_no if plc_no present
          const plcNo = plc.plc_no || 1;
          const existingNodes = await storage.getOpcuaNodesByPlcNo(plcNo);
          
          return res.status(409).json({
            error: "PLC already exists",
            message: `PLC with IP ${plc.plc_ip} and OPC UA URL ${plc.opcua_url} already exists in the database${existingNodes.length > 0 ? ` with ${existingNodes.length} nodes` : ''}. Please delete the existing PLC first and then re-upload.`,
            existing_plc: {
              ...existingPLC,
              existing_nodes_count: existingNodes.length
            },
            action_required: "delete_and_reupload"
          });
        }

        // Legacy check for nodes by plc_no (keep for safety)
        const plcNo = plc.plc_no || 1;
        const existingNodes = await storage.getOpcuaNodesByPlcNo(plcNo);
        if (existingNodes.length > 0) {
          console.log("⚠️ Duplicate nodes found for PLC No:", plcNo);
          return res.status(409).json({
            error: "Nodes already exist",
            message: `Nodes for PLC No. ${plcNo} already exist in the database (${existingNodes.length} nodes). Please delete the existing nodes first.`,
            existing_nodes_count: existingNodes.length,
            action_required: "delete_and_reupload"
          });
        }
      }

      let totalCreated = 0;
      const createdNodes = [];

      // Process each PLC in the JSON
      for (const plc of json.plcs) {
        console.log("🔧 Processing PLC:", plc.plc_name, "- PLC No:", plc.plc_no);
        
        if (!plc.address_mappings || !Array.isArray(plc.address_mappings)) {
          console.log("⚠️ Skipping PLC - no address_mappings found");
          continue;
        }

        console.log("📊 Found", plc.address_mappings.length, "address mappings for PLC", plc.plc_no);

        // Process each address mapping
        for (const mapping of plc.address_mappings) {
          const timestamp = new Date().toISOString();

          console.log("🔍 Checking mapping:", mapping.opcua_reg_add, "- Data type:", mapping.data_type);
          console.log("🔍 Has metadata?", !!mapping.metadata);
          console.log("🔍 Has bit_mappings?", !!(mapping.metadata && mapping.metadata.bit_mappings));

          // Check if this mapping has metadata (bit mappings)
          if (mapping.metadata && mapping.metadata.bit_mappings) {
            console.log("🔀 Processing bit mappings for:", mapping.opcua_reg_add);
            console.log("🔀 Number of bit mappings:", Object.keys(mapping.metadata.bit_mappings).length);
            
            // Create separate entries for each bit mapping
            for (const [bitKey, bitInfo] of Object.entries(mapping.metadata.bit_mappings)) {
              const bitData = bitInfo as any; // Type assertion for JSON data
              const bitPosition = bitData.bit_position.toString().padStart(2, '0');
              const nodeData = {
                plc_no: plc.plc_no, // Use PLC number from JSON
                nodeName: `${mapping.opcua_reg_add}_${bitPosition}`, // e.g., P1_IO_1_BC_00, P1_IO_1_BC_01
                description: bitData.description,
                value: "", // Empty for your logic
                timestamp: timestamp,
                datatype: "BOOL", // Bit mappings are always BOOL
                regAdd: bitData.address, // e.g., "1.00", "1.01"
                userDescription: "", // Empty initially
              };

              console.log("➕ Creating bit node:", nodeData.nodeName, "- Type:", nodeData.datatype, "- RegAdd:", nodeData.regAdd);
              const createdNode = await storage.createOpcuaNode(nodeData);
              console.log("✅ Created node with ID:", createdNode.id);
              
              createdNodes.push(createdNode);
              totalCreated++;
            }
          } else {
            // Create single entry for non-bit mappings
            const nodeData = {
              plc_no: plc.plc_no, // Use PLC number from JSON
              nodeName: mapping.opcua_reg_add, // e.g., P1_IO_2100_B02
              description: mapping.description,
              value: "", // Empty for your logic
              timestamp: timestamp,
              datatype: mapping.data_type, // word, bool, channel, udint, etc.
              regAdd: mapping.plc_reg_add, // e.g., "2100.02"
              userDescription: "", // Empty initially
            };

            console.log("➕ Creating single node:", nodeData.nodeName, "- Type:", nodeData.datatype);
            const createdNode = await storage.createOpcuaNode(nodeData);
            console.log("✅ Created node with ID:", createdNode.id);
            
            createdNodes.push(createdNode);
            totalCreated++;
          }
        }
      }

      console.log("🎉 Upload completed! Total nodes created:", totalCreated);
      
      res.json({ 
        success: true, 
        message: `Successfully created ${totalCreated} OPC UA nodes in database`,
        totalCreated: totalCreated,
        nodes: createdNodes
      });

    } catch (error) {
      if (error instanceof SyntaxError) {
        console.log("❌ JSON parsing error:", error.message);
        return res.status(400).json({ error: "Invalid JSON format" });
      }
      console.error("❌ Error processing upload:", error);
      res.status(500).json({ error: "Failed to process file and create database entries" });
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

  // User Description Routes
  app.get("/api/plcs/:plcId/descriptions/:nodeId", async (req, res) => {
    try {
      const { plcId, nodeId } = req.params;
      const description = await storage.getUserDescription(plcId, nodeId);
      if (!description) {
        return res.status(404).json({ error: "User description not found" });
      }
      res.json(description);
    } catch (error) {
      console.error("Error fetching user description:", error);
      res.status(500).json({ error: "Failed to fetch user description" });
    }
  });

  app.post("/api/plcs/:plcId/descriptions/:nodeId", async (req, res) => {
    try {
      const { plcId, nodeId } = req.params;
      const { description } = req.body;
      
      if (typeof description !== 'string') {
        return res.status(400).json({ error: "Description must be a string" });
      }
      
      const userDescription = await storage.saveUserDescription(plcId, nodeId, description);
      res.json(userDescription);
    } catch (error) {
      console.error("Error saving user description:", error);
      res.status(500).json({ error: "Failed to save user description" });
    }
  });

  app.get("/api/plcs/:plcId/descriptions", async (req, res) => {
    try {
      const { plcId } = req.params;
      const descriptions = await storage.getAllUserDescriptions(plcId);
      res.json(descriptions);
    } catch (error) {
      console.error("Error fetching user descriptions:", error);
      res.status(500).json({ error: "Failed to fetch user descriptions" });
    }
  });

  // NEW SQLite OPC UA Nodes Routes
  app.get("/api/opcua-nodes", async (req, res) => {
    try {
      const { plc_no } = req.query;
      let nodes;
      
      if (plc_no && typeof plc_no === 'string') {
        const plcNumber = parseInt(plc_no);
        if (!isNaN(plcNumber)) {
          nodes = await storage.getOpcuaNodesByPlcNo(plcNumber);
        } else {
          nodes = await storage.getAllOpcuaNodes();
        }
      } else {
        nodes = await storage.getAllOpcuaNodes();
      }
      
      res.json(nodes);
    } catch (error) {
      console.error("Error fetching OPC UA nodes:", error);
      res.status(500).json({ error: "Failed to fetch OPC UA nodes" });
    }
  });

  app.get("/api/opcua-nodes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid node ID" });
      }
      
      const node = await storage.getOpcuaNodeById(id);
      if (!node) {
        return res.status(404).json({ error: "OPC UA node not found" });
      }
      res.json(node);
    } catch (error) {
      console.error("Error fetching OPC UA node:", error);
      res.status(500).json({ error: "Failed to fetch OPC UA node" });
    }
  });

  app.post("/api/opcua-nodes", async (req, res) => {
    try {
      const nodeData = createOpcuaNodeSchema.parse(req.body);
      const node = await storage.createOpcuaNode(nodeData);
      res.status(201).json(node);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("OPC UA node validation error:", error.errors);
        return res.status(400).json({ error: "Invalid OPC UA node configuration", details: error.errors });
      }
      console.error("Error creating OPC UA node:", error);
      res.status(500).json({ error: "Failed to create OPC UA node" });
    }
  });

  app.put("/api/opcua-nodes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid node ID" });
      }
      
      const updates = updateOpcuaNodeSchema.parse(req.body);
      const node = await storage.updateOpcuaNode(id, updates);
      if (!node) {
        return res.status(404).json({ error: "OPC UA node not found" });
      }
      res.json(node);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("OPC UA node validation error:", error.errors);
        return res.status(400).json({ error: "Invalid OPC UA node updates", details: error.errors });
      }
      console.error("Error updating OPC UA node:", error);
      res.status(500).json({ error: "Failed to update OPC UA node" });
    }
  });

  app.delete("/api/opcua-nodes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid node ID" });
      }
      
      const deleted = await storage.deleteOpcuaNode(id);
      if (!deleted) {
        return res.status(404).json({ error: "OPC UA node not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting OPC UA node:", error);
      res.status(500).json({ error: "Failed to delete OPC UA node" });
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
