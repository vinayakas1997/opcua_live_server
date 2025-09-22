import { type PLC, type PLCConfig, type NodeData, type ServerStatus } from "@shared/schema";
import { randomUUID } from "crypto";

// Storage interface for OPC UA Dashboard
export interface IStorage {
  // PLC management
  getAllPLCs(): Promise<PLC[]>;
  getPLCById(id: string): Promise<PLC | undefined>;
  createPLC(config: PLCConfig): Promise<PLC>;
  updatePLC(id: string, updates: Partial<PLC>): Promise<PLC | undefined>;
  deletePLC(id: string): Promise<boolean>;
  
  // Node data management
  getNodeData(plcId: string): Promise<NodeData[]>;
  updateNodeData(plcId: string, data: NodeData[]): Promise<void>;
  
  // Server status management
  getServerStatuses(): Promise<ServerStatus[]>;
  updateServerStatus(opcuaUrl: string, status: ServerStatus): Promise<void>;
}

export class MemStorage implements IStorage {
  private plcs: Map<string, PLC>;
  private nodeData: Map<string, NodeData[]>;
  private serverStatuses: Map<string, ServerStatus>;

  constructor() {
    this.plcs = new Map();
    this.nodeData = new Map();
    this.serverStatuses = new Map();
    
    // Initialize with mock PLCs from schema
    import("@shared/schema").then(({ mockPLCs }) => {
      mockPLCs.forEach(plc => {
        this.plcs.set(plc.id, plc);
      });
    });
  }

  async getAllPLCs(): Promise<PLC[]> {
    return Array.from(this.plcs.values());
  }

  async getPLCById(id: string): Promise<PLC | undefined> {
    return this.plcs.get(id);
  }

  async createPLC(config: PLCConfig): Promise<PLC> {
    const id = randomUUID();
    const plc: PLC = {
      ...config,
      id,
      status: "maintenance",
      last_checked: new Date(),
      is_connected: false,
      created_at: new Date(),
    };
    this.plcs.set(id, plc);
    return plc;
  }

  async updatePLC(id: string, updates: Partial<PLC>): Promise<PLC | undefined> {
    const existing = this.plcs.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.plcs.set(id, updated);
    return updated;
  }

  async deletePLC(id: string): Promise<boolean> {
    return this.plcs.delete(id);
  }

  async getNodeData(plcId: string): Promise<NodeData[]> {
    return this.nodeData.get(plcId) || [];
  }

  async updateNodeData(plcId: string, data: NodeData[]): Promise<void> {
    this.nodeData.set(plcId, data);
  }

  async getServerStatuses(): Promise<ServerStatus[]> {
    return Array.from(this.serverStatuses.values());
  }

  async updateServerStatus(opcuaUrl: string, status: ServerStatus): Promise<void> {
    this.serverStatuses.set(opcuaUrl, status);
  }
}

export const storage = new MemStorage();
