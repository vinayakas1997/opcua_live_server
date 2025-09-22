import type { PLC, PLCConfig, NodeData, ServerStatus } from "@shared/schema";

const API_BASE = "/api";

export const api = {
  // PLC Management
  async getAllPLCs(): Promise<PLC[]> {
    const response = await fetch(`${API_BASE}/plcs`);
    if (!response.ok) throw new Error("Failed to fetch PLCs");
    return response.json();
  },

  async getPLCById(id: string): Promise<PLC> {
    const response = await fetch(`${API_BASE}/plcs/${id}`);
    if (!response.ok) throw new Error("Failed to fetch PLC");
    return response.json();
  },

  async createPLC(config: PLCConfig): Promise<PLC> {
    const response = await fetch(`${API_BASE}/plcs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!response.ok) throw new Error("Failed to create PLC");
    return response.json();
  },

  async updatePLC(id: string, updates: Partial<PLC>): Promise<PLC> {
    const response = await fetch(`${API_BASE}/plcs/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error("Failed to update PLC");
    return response.json();
  },

  async deletePLC(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/plcs/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete PLC");
  },

  // Connection Management
  async connectPLC(id: string): Promise<PLC> {
    const response = await fetch(`${API_BASE}/plcs/${id}/connect`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Failed to connect PLC");
    return response.json();
  },

  async disconnectPLC(id: string): Promise<PLC> {
    const response = await fetch(`${API_BASE}/plcs/${id}/disconnect`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Failed to disconnect PLC");
    return response.json();
  },

  // Node Data
  async getNodeData(plcId: string): Promise<NodeData[]> {
    const response = await fetch(`${API_BASE}/plcs/${plcId}/data`);
    if (!response.ok) throw new Error("Failed to fetch node data");
    return response.json();
  },

  // File Upload
  async uploadJSONConfig(file: File): Promise<{ success: boolean; config: PLCConfig }> {
    const formData = new FormData();
    formData.append("jsonFile", file);

    const response = await fetch(`${API_BASE}/upload/json`, {
      method: "POST",
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to upload file");
    }
    
    return response.json();
  },

  // Server Status
  async getServerStatuses(): Promise<ServerStatus[]> {
    const response = await fetch(`${API_BASE}/servers/status`);
    if (!response.ok) throw new Error("Failed to fetch server statuses");
    return response.json();
  },

  // Data Export
  async exportCSV(plcId?: string): Promise<Blob> {
    const url = plcId ? `${API_BASE}/export/csv?plcId=${plcId}` : `${API_BASE}/export/csv`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to export CSV");
    return response.blob();
  },
};