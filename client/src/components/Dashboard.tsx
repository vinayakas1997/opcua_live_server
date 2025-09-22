import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Plus, Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppSidebar } from "./AppSidebar";
import LanguageSwitcher from "./LanguageSwitcher";
import JsonUploader from "./JsonUploader";
import LiveDataTable from "./LiveDataTable";
import { api } from "@/lib/api";
import { socketManager } from "@/lib/socket";
import { useToast } from "@/hooks/use-toast";
import { type Language, type PLCConfig, type PLC, type NodeData } from "@shared/schema";

export default function Dashboard() {
  const [language, setLanguage] = useState<Language>("en");
  const [selectedPLCs, setSelectedPLCs] = useState<Set<string>>(new Set());
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [nodeData, setNodeData] = useState<NodeData[]>([]);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch PLCs
  const { data: plcs = [], isLoading } = useQuery({
    queryKey: ["/api/plcs"],
    queryFn: api.getAllPLCs,
  });

  // Connect PLC mutation
  const connectMutation = useMutation({
    mutationFn: api.connectPLC,
    onSuccess: (updatedPLC) => {
      queryClient.invalidateQueries({ queryKey: ["/api/plcs"] });
      setSelectedPLCs(prev => new Set(Array.from(prev).concat(updatedPLC.id)));
      socketManager.subscribeToPLC(updatedPLC.id);
      toast({
        title: "PLC Connected",
        description: `Successfully connected to ${updatedPLC.plc_name}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Disconnect PLC mutation
  const disconnectMutation = useMutation({
    mutationFn: api.disconnectPLC,
    onSuccess: (updatedPLC) => {
      queryClient.invalidateQueries({ queryKey: ["/api/plcs"] });
      setSelectedPLCs(prev => {
        const newSet = new Set(prev);
        newSet.delete(updatedPLC.id);
        return newSet;
      });
      socketManager.unsubscribeFromPLC(updatedPLC.id);
      toast({
        title: "PLC Disconnected",
        description: `Disconnected from ${updatedPLC.plc_name}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Disconnection Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create PLC mutation
  const createMutation = useMutation({
    mutationFn: api.createPLC,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plcs"] });
      toast({
        title: "PLC Added",
        description: "Successfully added new PLC configuration",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Add PLC",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // WebSocket connection
  useEffect(() => {
    const socket = socketManager.connect();

    socket.on("nodeDataUpdate", (data: NodeData[]) => {
      setNodeData(data);
    });

    socket.on("plcs", (data: PLC[]) => {
      queryClient.setQueryData(["/api/plcs"], data);
    });

    return () => {
      socketManager.disconnect();
    };
  }, [queryClient]);

  const handleConfigUploaded = (config: PLCConfig) => {
    createMutation.mutate(config);
    setIsUploadDialogOpen(false);
  };

  const handleConnectPLC = (plcId: string) => {
    connectMutation.mutate(plcId);
  };

  const handleDisconnectPLC = (plcId: string) => {
    disconnectMutation.mutate(plcId);
  };

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

  const connectedPLCs = plcs.filter(plc => selectedPLCs.has(plc.id));
  
  // Custom sidebar width for better content layout
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem", 
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar 
          plcs={plcs}
          selectedPLCs={selectedPLCs}
          onConnect={handleConnectPLC}
          onDisconnect={handleDisconnectPLC}
          onRefresh={(id) => console.log(`Refresh PLC ${id}`)}
          onConfigure={(id) => console.log(`Configure PLC ${id}`)}
        />
        
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              
              <div className="flex items-center gap-2">
                <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-new">
                      <Plus className="h-4 w-4 mr-2" />
                      Add New
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add New PLC Configuration</DialogTitle>
                    </DialogHeader>
                    <JsonUploader 
                      onConfigUploaded={handleConfigUploaded}
                      onClose={() => setIsUploadDialogOpen(false)}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Global search..."
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  className="pl-10 w-64"
                  data-testid="input-global-search"
                />
              </div>
              
              <LanguageSwitcher 
                currentLanguage={language} 
                onLanguageChange={setLanguage}
              />
            </div>
          </header>

          <main className="flex-1 p-6 overflow-auto bg-muted/30">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">OPC UA Dashboard</h1>
                  <p className="text-muted-foreground mt-1">
                    Real-time monitoring of {connectedPLCs.length} connected PLC{connectedPLCs.length !== 1 ? 's' : ''}
                  </p>
                </div>
                
                <div className="text-sm text-muted-foreground text-right">
                  <div className="font-mono">
                    {connectedPLCs.length} / {plcs.length} PLCs Connected
                  </div>
                  <div className="text-xs">
                    Last updated: {new Date().toLocaleTimeString()}
                  </div>
                </div>
              </div>

              {connectedPLCs.length > 0 ? (
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
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}