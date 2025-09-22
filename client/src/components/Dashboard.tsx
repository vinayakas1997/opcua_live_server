import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import LiveDataTable from "./LiveDataTable";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { type NodeData, type PLC } from "@shared/schema";

export default function Dashboard() {
  const [nodeData, setNodeData] = useState<NodeData[]>([]);
  
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Parse plcId from query parameters
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const selectedPlcId = searchParams.get('plcId');

  // Fetch PLCs
  const { data: plcs = [], isLoading } = useQuery({
    queryKey: ["/api/plcs"],
    queryFn: api.getAllPLCs,
  });

  const selectedPLC = selectedPlcId ? plcs.find(p => p.id === selectedPlcId) : null;
  const connectedPLCs = plcs.filter(plc => plc.is_connected);

  const handleExportCSV = async () => {
    try {
      const blob = await api.exportCSV();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `node_data_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export Successful",
        description: "CSV file has been downloaded",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export CSV data",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {selectedPLC && (
        <div className="p-6 border-b bg-muted/50">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold" data-testid="text-plc-name">
              {selectedPLC.plc_name}
            </h2>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span data-testid="text-plc-ip">
                <strong>IP:</strong> {selectedPLC.plc_ip}
              </span>
              <span data-testid="text-opcua-url">
                <strong>OPCUA URL:</strong> {selectedPLC.opcua_url}
              </span>
              <span data-testid="text-register-count">
                <strong>Registers:</strong> {nodeData.length}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold" data-testid="text-dashboard-title">
            {selectedPLC ? `${selectedPLC.plc_name} Variables` : "OPC UA Dashboard"}
          </h1>
          <div className="text-sm text-muted-foreground" data-testid="text-plcs-connected">
            {connectedPLCs.length}/{plcs.length} PLCs Connected
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {connectedPLCs.length > 0 || selectedPLC ? (
          <LiveDataTable 
            data={nodeData}
            onExportCSV={handleExportCSV}
            onRefresh={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/plcs"] });
              toast({
                title: "Data Refreshed",
                description: "PLC data has been updated",
              });
            }}
          />
        ) : (
          <div className="text-center py-24 text-muted-foreground">
            <div className="space-y-4">
              <h3 className="text-xl font-medium">
                {isLoading ? "Loading PLCs..." : plcs.length === 0 ? "No PLCs Available" : "No PLCs Connected"}
              </h3>
              <p className="text-sm max-w-md mx-auto">
                {isLoading ? "Please wait while we load your PLC configurations..." :
                 plcs.length === 0 ? "Add new PLC configurations using the \"Add New\" button to get started." :
                 "Connect to one or more PLCs from the sidebar to start monitoring live data."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}