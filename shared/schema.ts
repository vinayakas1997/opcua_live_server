import { z } from "zod";

// PLC Configuration Schema
export const plcConfigSchema = z.object({
  plc_name: z.string().min(1, "PLC name is required"),
  plc_no: z.number().int().positive("PLC number must be positive"),
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

export type PLCConfig = z.infer<typeof plcConfigSchema>;
export type PLC = z.infer<typeof plcSchema>;
export type NodeData = z.infer<typeof nodeDataSchema>;
export type ServerStatus = z.infer<typeof serverStatusSchema>;
export type PLCStatus = "active" | "maintenance" | "error";
export type ConnectionStatus = "active" | "inactive" | "error";

// Language types
export type Language = "en" | "jp";

// Mock data for development
export const mockPLCs: PLC[] = [
  {
    id: "1",
    plc_name: "Production Line A Controller",
    plc_no: 101,
    plc_ip: "192.168.1.10",
    opcua_url: "opc.tcp://192.168.1.10:4840",
    address_mappings: [
      { node_name: "Temperature_01", node_id: "ns=2;i=1001", description: "Main temperature sensor", data_type: "Float" },
      { node_name: "Pressure_01", node_id: "ns=2;i=1002", description: "System pressure", data_type: "Float" },
      { node_name: "Motor_Speed", node_id: "ns=2;i=1003", description: "Motor RPM", data_type: "Int32" },
    ],
    status: "active",
    last_checked: new Date(),
    is_connected: true,
    created_at: new Date(),
  },
  {
    id: "2",
    plc_name: "Packaging Unit B",
    plc_no: 102,
    plc_ip: "192.168.1.11",
    opcua_url: "opc.tcp://192.168.1.11:4840",
    address_mappings: [
      { node_name: "Conveyor_Speed", node_id: "ns=2;i=2001", description: "Conveyor belt speed", data_type: "Float" },
      { node_name: "Package_Count", node_id: "ns=2;i=2002", description: "Total packages", data_type: "Int32" },
    ],
    status: "maintenance",
    last_checked: new Date(),
    is_connected: false,
    created_at: new Date(),
  },
  {
    id: "3",
    plc_name: "Quality Control System",
    plc_no: 103,
    plc_ip: "192.168.1.12",
    opcua_url: "opc.tcp://192.168.1.12:4840",
    address_mappings: [
      { node_name: "Test_Result", node_id: "ns=2;i=3001", description: "Quality test result", data_type: "Boolean" },
      { node_name: "Error_Count", node_id: "ns=2;i=3002", description: "Error counter", data_type: "Int32" },
    ],
    status: "error",
    last_checked: new Date(),
    is_connected: false,
    created_at: new Date(),
  },
];

export const mockNodeData: NodeData[] = [
  {
    node_id: "ns=2;i=1001",
    node_name: "Temperature_01",
    current_value: 23.5,
    timestamp: new Date(),
    quality: "Good",
    data_type: "Float",
  },
  {
    node_id: "ns=2;i=1002",
    node_name: "Pressure_01",
    current_value: 1.2,
    timestamp: new Date(),
    quality: "Good",
    data_type: "Float",
  },
  {
    node_id: "ns=2;i=1003",
    node_name: "Motor_Speed",
    current_value: 1450,
    timestamp: new Date(),
    quality: "Good",
    data_type: "Int32",
  },
];
