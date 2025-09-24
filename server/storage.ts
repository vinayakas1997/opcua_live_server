import { type PLC, type PLCConfig, type NodeData, type ServerStatus, type UserDescription, mockPLCs } from "@shared/schema";
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
  
  // User descriptions management
  getUserDescription(plcId: string, nodeId: string): Promise<UserDescription | undefined>;
  saveUserDescription(plcId: string, nodeId: string, description: string): Promise<UserDescription>;
  getAllUserDescriptions(plcId: string): Promise<UserDescription[]>;
}

export class MemStorage implements IStorage {
  private plcs: Map<string, PLC>;
  private nodeData: Map<string, NodeData[]>;
  private serverStatuses: Map<string, ServerStatus>;
  private userDescriptions: Map<string, UserDescription>;

  constructor() {
    this.plcs = new Map();
    this.nodeData = new Map();
    this.serverStatuses = new Map();
    this.userDescriptions = new Map();
    
    // Initialize with mock PLCs from schema (synchronous)
    mockPLCs.forEach(plc => {
      this.plcs.set(plc.id, plc);
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

  async getUserDescription(plcId: string, nodeId: string): Promise<UserDescription | undefined> {
    const key = `${plcId}-${nodeId}`;
    return this.userDescriptions.get(key);
  }

  async saveUserDescription(plcId: string, nodeId: string, description: string): Promise<UserDescription> {
    const key = `${plcId}-${nodeId}`;
    const existing = this.userDescriptions.get(key);
    const now = new Date();
    
    const userDescription: UserDescription = {
      id: existing?.id || randomUUID(),
      plc_id: plcId,
      node_id: nodeId,
      user_description: description,
      created_at: existing?.created_at || now,
      updated_at: now,
    };
    
    this.userDescriptions.set(key, userDescription);
    return userDescription;
  }

  async getAllUserDescriptions(plcId: string): Promise<UserDescription[]> {
    return Array.from(this.userDescriptions.values()).filter(desc => desc.plc_id === plcId);
  }
}

export const storage = new MemStorage();
