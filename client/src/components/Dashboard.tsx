import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import EnhancedVariablesTable from "./EnhancedVariablesTable";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { type NodeData, type PLC } from "@shared/schema";
import { type NormalizedPLC, type NormalizedVariable } from "@shared/normalization";

export default function Dashboard() {
  const [nodeData, setNodeData] = useState<NodeData[]>([]);
  
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();

  // Parse plcId from query parameters
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const selectedPlcId = searchParams.get('plcId');

  // Fetch PLCs
  const { data: plcs = [], isLoading } = useQuery({
    queryKey: ["/api/plcs"],
    queryFn: api.getAllPLCs,
  });

  const connectedPLCs = plcs.filter(plc => plc.is_connected);
  
  // Select PLC: either from URL param or first connected PLC
  const selectedPLC = selectedPlcId 
    ? plcs.find(p => p.id === selectedPlcId) 
    : connectedPLCs.length > 0 ? connectedPLCs[0] : null;

  // Convert regular PLC to NormalizedPLC with mock variables for testing
  const createMockNormalizedPLC = (plc: PLC): NormalizedPLC => {
    const mockVariables: NormalizedVariable[] = [
      // Channel variable with children
      {
        id: `${plc.id}_ch1`,
        type: 'channel',
        plc_reg_add: 'D100',
        opcua_reg_add: 'ns=2;i=1001',
        description: 'Motor Control Status Register',
        data_type: 'channel',
        hasChildren: true,
      },
      // Child bit variables
      {
        id: `${plc.id}_ch1_bit0`,
        type: 'bool',
        plc_reg_add: 'D100.0',
        opcua_reg_add: 'ns=2;i=1001.0',
        description: 'Motor Running Status',
        data_type: 'bool',
        parentId: `${plc.id}_ch1`,
        bitPosition: 0,
      },
      {
        id: `${plc.id}_ch1_bit1`,
        type: 'bool',
        plc_reg_add: 'D100.1',
        opcua_reg_add: 'ns=2;i=1001.1',
        description: 'Motor Alarm Status',
        data_type: 'bool',
        parentId: `${plc.id}_ch1`,
        bitPosition: 1,
      },
      {
        id: `${plc.id}_ch1_bit2`,
        type: 'bool',
        plc_reg_add: 'D100.2',
        opcua_reg_add: 'ns=2;i=1001.2',
        description: 'Emergency Stop Active',
        data_type: 'bool',
        parentId: `${plc.id}_ch1`,
        bitPosition: 2,
      },
      // Another channel variable
      {
        id: `${plc.id}_ch2`,
        type: 'channel',
        plc_reg_add: 'D101',
        opcua_reg_add: 'ns=2;i=1002',
        description: 'Temperature Sensor Data',
        data_type: 'channel',
        hasChildren: true,
      },
      // Child variables for temperature
      {
        id: `${plc.id}_ch2_bit0`,
        type: 'bool',
        plc_reg_add: 'D101.0',
        opcua_reg_add: 'ns=2;i=1002.0',
        description: 'Temperature High Warning',
        data_type: 'bool',
        parentId: `${plc.id}_ch2`,
        bitPosition: 0,
      },
      {
        id: `${plc.id}_ch2_bit1`,
        type: 'bool',
        plc_reg_add: 'D101.1',
        opcua_reg_add: 'ns=2;i=1002.1',
        description: 'Temperature Critical Alert',
        data_type: 'bool',
        parentId: `${plc.id}_ch2`,
        bitPosition: 1,
      },
      // Standalone bool variables
      {
        id: `${plc.id}_bool1`,
        type: 'bool',
        plc_reg_add: 'M10',
        opcua_reg_add: 'ns=2;i=2001',
        description: 'Manual Override Enable',
        data_type: 'bool',
      },
      {
        id: `${plc.id}_bool2`,
        type: 'bool',
        plc_reg_add: 'M11',
        opcua_reg_add: 'ns=2;i=2002',
        description: 'Maintenance Mode Active',
        data_type: 'bool',
      },
    ];

    return {
      id: plc.id,
      plc_name: plc.plc_name,
      plc_ip: plc.plc_ip,
      opcua_url: plc.opcua_url,
      status: plc.status,
      last_checked: plc.last_checked,
      is_connected: plc.is_connected,
      created_at: plc.created_at,
      variables: mockVariables,
      registerCount: mockVariables.length,
      boolCount: mockVariables.filter(v => v.type === 'bool').length,
      channelCount: mockVariables.filter(v => v.type === 'channel').length,
    };
  };

  const normalizedSelectedPLC = selectedPLC ? createMockNormalizedPLC(selectedPLC) : null;
  
  // Debug logging (cleaned up for production)
  // console.log('Selected PLC:', selectedPLC);
  // console.log('Normalized PLC:', normalizedSelectedPLC);
  // console.log('Variables count:', normalizedSelectedPLC?.variables?.length || 0);

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
                <strong>Registers:</strong> {normalizedSelectedPLC?.registerCount || 0}
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
          <div className="text-right">
            <div className="text-sm text-muted-foreground" data-testid="text-plcs-connected">
              {connectedPLCs.length}/{plcs.length} PLCs Connected
            </div>
            <div className="text-sm text-muted-foreground" data-testid="text-last-updated">
              {t("lastUpdated")}: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {connectedPLCs.length > 0 || selectedPLC ? (
          <EnhancedVariablesTable 
            plc={normalizedSelectedPLC || undefined}
            onExportCSV={handleExportCSV}
            onRefresh={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/plcs"] });
              toast({
                title: t("success"),
                description: t("dataRefreshed"),
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