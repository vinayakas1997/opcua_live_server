import { z } from "zod";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Raw JSON PLC Configuration Schema (as uploaded)
export const rawPLCConfigSchema = z.object({
  plc_name: z.string().min(1, "PLC name is required"),
  plc_no: z.number().int().positive("PLC number must be positive"),
  plc_ip: z.string().ip("Invalid IP address"),
  opcua_url: z.string().url("Invalid OPC UA URL"),
  address_mappings: z.array(z.object({
    plc_reg_add: z.string(),
    data_type: z.string(), // Accept any string data type (word, bool, channel, udint, etc.)
    opcua_reg_add: z.string(),
    description: z.string(),
    Memory_Area: z.string().optional(),
    metadata: z.object({
      bit_count: z.number(),
      bit_mappings: z.record(z.object({
        address: z.string(),
        description: z.string(),
        bit_position: z.number(),
      })),
    }).optional(),
  })),
});

// Raw JSON file structure
export const rawJSONSchema = z.object({
  plcs: z.array(rawPLCConfigSchema),
});

// Internal PLC Configuration Schema (for API)
export const plcConfigSchema = z.object({
  plc_name: z.string().min(1, "PLC name is required"),
  plc_no: z.number().int().positive("PLC number must be positive").optional(),
  plc_ip: z.string().ip("Invalid IP address"),
  opcua_url: z.string().url("Invalid OPC UA URL"),
  address_mappings: z.array(z.object({
    node_name: z.string(),
    node_id: z.string(),
    description: z.string().optional(),
    data_type: z.string().optional(),
  })),
});

// PLC with status and runtime info
export const plcSchema = plcConfigSchema.extend({
  id: z.string(),
  status: z.enum(["active", "maintenance", "error"]),
  last_checked: z.date(),
  is_connected: z.boolean(),
  created_at: z.date(),
});

// OPC UA Node Data
export const nodeDataSchema = z.object({
  node_id: z.string(),
  node_name: z.string(),
  current_value: z.any(),
  timestamp: z.date(),
  quality: z.string().optional(),
  data_type: z.string().optional(),
});

// Server Connection Status
export const serverStatusSchema = z.object({
  opcua_url: z.string(),
  is_connected: z.boolean(),
  status: z.enum(["active", "inactive", "error"]),
  last_update: z.date(),
  node_count: z.number().optional(),
});

// User Description Schema for storing custom descriptions
export const userDescriptionSchema = z.object({
  id: z.string(),
  plc_id: z.string(),
  node_id: z.string(),
  user_description: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
});

// NEW SQLite Database Schema using Drizzle ORM
export const opcuaNodesTable = sqliteTable("opcua_nodes", {
  id: integer("id").primaryKey({ autoIncrement: true }), // Auto-increment primary key
  plc_no: integer("plc_no").notNull(), // PLC number from JSON for filtering
  nodeName: text("node_name").notNull(), // opcua_reg_add
  description: text("description").notNull(),
  value: text("value"), // Empty initially, will be populated with your logic
  timestamp: text("timestamp").notNull(), // 24hr format timestamp
  datatype: text("datatype").notNull(),
  regAdd: text("reg_add").notNull(), // plc_reg_add
  userDescription: text("user_description"),
});

export const plcsTable = sqliteTable("plcs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  plcName: text("plc_name").notNull(),
  plcIp: text("plc_ip").notNull(),
  plcNo: integer("plc_no").notNull(),
  opcuaUrl: text("opcua_url").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});


// Zod schemas for the new SQLite table
export const opcuaNodeSchema = z.object({
  id: z.number().int().positive("ID must be positive").optional(), // Auto-generated
  plc_no: z.number().int().positive("PLC number must be positive"),
  nodeName: z.string().min(1, "Node name is required"),
  description: z.string().min(1, "Description is required"),
  value: z.string().optional(),
  timestamp: z.string().min(1, "Timestamp is required"),
  datatype: z.string().min(1, "Datatype is required"),
  regAdd: z.string().min(1, "Register address is required"),
  userDescription: z.string().optional(),
});

export const createOpcuaNodeSchema = opcuaNodeSchema.omit({ id: true });
export const updateOpcuaNodeSchema = opcuaNodeSchema.partial().omit({ id: true });

// Zod schemas for plcs table
export const plcsDbSchema = z.object({
  id: z.number().int().positive("ID must be positive").optional(), // Auto-generated
  plcName: z.string().min(1, "PLC name is required"),
  plcIp: z.string().ip("Invalid IP address"),
  plcNo: z.number().int().positive("PLC number must be positive"),
  opcuaUrl: z.string().url("Invalid OPC UA URL"),
  createdAt: z.string().optional(),
});

export const createPlcsDbSchema = plcsDbSchema.omit({ id: true, createdAt: true });
export const updatePlcsDbSchema = plcsDbSchema.partial().omit({ id: true });

// Types
export type RawPLCConfig = z.infer<typeof rawPLCConfigSchema>;
export type RawJSONData = z.infer<typeof rawJSONSchema>;
export type PLCConfig = z.infer<typeof plcConfigSchema>;
export type PLC = z.infer<typeof plcSchema>;
export type NodeData = z.infer<typeof nodeDataSchema>;
export type ServerStatus = z.infer<typeof serverStatusSchema>;
export type UserDescription = z.infer<typeof userDescriptionSchema>;
export type PLCStatus = "active" | "maintenance" | "error";
export type ConnectionStatus = "active" | "inactive" | "error";

// New types for SQLite table
export type OpcuaNode = z.infer<typeof opcuaNodeSchema>;
export type CreateOpcuaNode = z.infer<typeof createOpcuaNodeSchema>;
export type UpdateOpcuaNode = z.infer<typeof updateOpcuaNodeSchema>;

export type PlcDb = z.infer<typeof plcsDbSchema>;
export type CreatePlcDb = z.infer<typeof createPlcsDbSchema>;
export type UpdatePlcDb = z.infer<typeof updatePlcsDbSchema>;

// Language types
export type Language = "en" | "jp";

// Mock data for development (removed as requested)
export const mockPLCs: PLC[] = [];

export const mockNodeData: NodeData[] = [];