import { type PLC, type PLCConfig, type NodeData, type ServerStatus, type UserDescription, type OpcuaNode, type CreateOpcuaNode, type UpdateOpcuaNode } from "@shared/schema";
import { randomUUID } from "crypto";
import { db, opcuaNodesTable, plcsTable } from "./db";
import { eq, and } from "drizzle-orm";

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

  // New SQLite OPC UA Nodes management
  getAllOpcuaNodes(): Promise<OpcuaNode[]>;
  getOpcuaNodeById(id: number): Promise<OpcuaNode | undefined>;
  getOpcuaNodesByPlcNo(plcNo: number): Promise<OpcuaNode[]>;
  createOpcuaNode(node: CreateOpcuaNode): Promise<OpcuaNode>;
  updateOpcuaNode(id: number, updates: UpdateOpcuaNode): Promise<OpcuaNode | undefined>;
  deleteOpcuaNode(id: number): Promise<boolean>;
}

export class SqliteStorage implements IStorage {
  private nodeData: Map<string, NodeData[]>;
  private serverStatuses: Map<string, ServerStatus>;
  private userDescriptions: Map<string, UserDescription>;

  constructor() {
    this.nodeData = new Map();
    this.serverStatuses = new Map();
    this.userDescriptions = new Map();
  }

  // PLC methods (now using DB)
  async getAllPLCs(): Promise<PLC[]> {
    const results = await db.select().from(plcsTable);
    return results.map(row => ({
      id: row.id,
      plc_name: row.plcName,
      plc_no: row.plcNo,
      plc_ip: row.plcIp,
      opcua_url: row.opcuaUrl,
      status: row.status,
      last_checked: new Date(row.lastChecked),
      is_connected: Boolean(row.isConnected),
      created_at: new Date(row.createdAt),
      address_mappings: [], // Filled by client or other logic
    }));
  }

  async getPLCById(id: string): Promise<PLC | undefined> {
    const results = await db.select().from(plcsTable).where(eq(plcsTable.id, id));
    if (!results[0]) return undefined;
    const row = results[0];
    return {
      ...row,
      last_checked: new Date(row.last_checked),
      created_at: new Date(row.created_at),
      is_connected: Boolean(row.is_connected),
      address_mappings: [], // Filled by client or other logic
    };
  }

  async createPLC(config: PLCConfig): Promise<PLC> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const plcData = {
      id,
      plc_name: config.plc_name,
      plc_no: config.plc_no,
      plc_ip: config.plc_ip,
      opcua_url: config.opcua_url,
      status: "maintenance",
      last_checked: now,
      is_connected: 0,
      created_at: now,
    };

    // Insert and check for unique constraint violation (plc_ip unique)
    try {
      const result = await db.insert(plcsTable).values(plcData).returning();
      const row = result[0];
      return {
        ...row,
        last_checked: new Date(row.last_checked),
        created_at: new Date(row.created_at),
        is_connected: Boolean(row.is_connected),
        address_mappings: config.address_mappings,
      };
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error(`PLC with IP ${config.plc_ip} already exists`);
      }
      throw error;
    }
  }

  async updatePLC(id: string, updates: Partial<PLC>): Promise<PLC | undefined> {
    const existing = await this.getPLCById(id);
    if (!existing) return undefined;

    const updateData: any = {};
    if (updates.plc_name !== undefined) updateData.plc_name = updates.plc_name;
    if (updates.plc_no !== undefined) updateData.plc_no = updates.plc_no;
    if (updates.plc_ip !== undefined) updateData.plc_ip = updates.plc_ip;
    if (updates.opcua_url !== undefined) updateData.opcua_url = updates.opcua_url;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.last_checked !== undefined) updateData.last_checked = updates.last_checked.toISOString();
    if (updates.is_connected !== undefined) updateData.is_connected = updates.is_connected ? 1 : 0;

    await db.update(plcsTable).set(updateData).where(eq(plcsTable.id, id));
    return await this.getPLCById(id);
  }

  async deletePLC(id: string): Promise<boolean> {
    const result = await db.delete(plcsTable).where(eq(plcsTable.id, id));
    return result.changes > 0;
  }

  // Delete PLC by plc_no (for deletion endpoint)
  async deletePLCByPlcNo(plcNo: number): Promise<boolean> {
    const results = await db.select().from(plcsTable).where(eq(plcsTable.plc_no, plcNo));
    if (results.length === 0) return false;
    // Delete the first matching (assume unique plc_no, but handle multiple if needed)
    const result = await db.delete(plcsTable).where(eq(plcsTable.id, results[0].id));
    return result.changes > 0;
  }

  // Check for existing PLC by plc_ip and opcua_url
  async getPLCByIpAndUrl(plc_ip: string, opcua_url: string): Promise<PLC | undefined> {
    const results = await db.select().from(plcsTable)
      .where(
        and(
          eq(plcsTable.plc_ip, plc_ip),
          eq(plcsTable.opcua_url, opcua_url)
        )
      );
    if (!results[0]) return undefined;
    const row = results[0];
    return {
      ...row,
      last_checked: new Date(row.last_checked),
      created_at: new Date(row.created_at),
      is_connected: Boolean(row.is_connected),
      address_mappings: [],
    };
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

  // New SQLite OPC UA Nodes methods
  async getAllOpcuaNodes(): Promise<OpcuaNode[]> {
    const nodes = await db.select().from(opcuaNodesTable);
    return nodes.map(node => ({
      ...node,
      value: node.value || undefined,
      userDescription: node.userDescription || undefined,
    }));
  }

  async getOpcuaNodeById(id: number): Promise<OpcuaNode | undefined> {
    const nodes = await db.select().from(opcuaNodesTable).where(eq(opcuaNodesTable.id, id));
    if (!nodes[0]) return undefined;
    
    return {
      ...nodes[0],
      value: nodes[0].value || undefined,
      userDescription: nodes[0].userDescription || undefined,
    };
  }

  async getOpcuaNodesByPlcNo(plcNo: number): Promise<OpcuaNode[]> {
    const nodes = await db.select().from(opcuaNodesTable).where(eq(opcuaNodesTable.plc_no, plcNo));
    return nodes.map(node => ({
      ...node,
      value: node.value || undefined,
      userDescription: node.userDescription || undefined,
    }));
  }

  async createOpcuaNode(node: CreateOpcuaNode): Promise<OpcuaNode> {
    const now = new Date().toISOString();
    const nodeData = {
      plc_no: node.plc_no,
      nodeName: node.nodeName,
      description: node.description,
      value: node.value || "",
      timestamp: node.timestamp || now,
      datatype: node.datatype,
      regAdd: node.regAdd,
      userDescription: node.userDescription || "",
    };

    console.log("💾 Storage: Inserting node into database:", {
      plc_no: nodeData.plc_no,
      nodeName: nodeData.nodeName,
      datatype: nodeData.datatype,
      regAdd: nodeData.regAdd
    });

    const result = await db.insert(opcuaNodesTable).values(nodeData).returning();
    
    console.log("✅ Storage: Node successfully inserted with ID:", result[0].id);
    
    return {
      ...result[0],
      value: result[0].value || undefined,
      userDescription: result[0].userDescription || undefined,
    };
  }

  async updateOpcuaNode(id: number, updates: UpdateOpcuaNode): Promise<OpcuaNode | undefined> {
    const existing = await this.getOpcuaNodeById(id);
    if (!existing) return undefined;

    const updateData: any = {};
    if (updates.plc_no !== undefined) updateData.plc_no = updates.plc_no;
    if (updates.nodeName !== undefined) updateData.nodeName = updates.nodeName;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.value !== undefined) updateData.value = updates.value;
    if (updates.timestamp !== undefined) updateData.timestamp = updates.timestamp;
    if (updates.datatype !== undefined) updateData.datatype = updates.datatype;
    if (updates.regAdd !== undefined) updateData.regAdd = updates.regAdd;
    if (updates.userDescription !== undefined) updateData.userDescription = updates.userDescription;

    await db.update(opcuaNodesTable).set(updateData).where(eq(opcuaNodesTable.id, id));
    
    return await this.getOpcuaNodeById(id);
  }

  async deleteOpcuaNode(id: number): Promise<boolean> {
    const result = await db.delete(opcuaNodesTable).where(eq(opcuaNodesTable.id, id));
    return result.changes > 0;
  }
}

export const storage = new SqliteStorage();
