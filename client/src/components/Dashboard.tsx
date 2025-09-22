import { useState } from "react";
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
import { AppSidebar } from "./AppSidebar";
import LanguageSwitcher from "./LanguageSwitcher";
import JsonUploader from "./JsonUploader";
import LiveDataTable from "./LiveDataTable";
import { mockPLCs, mockNodeData, type Language, type PLCConfig, type PLC } from "@shared/schema";

export default function Dashboard() {
  const [language, setLanguage] = useState<Language>("en");
  const [plcs, setPLCs] = useState<PLC[]>(mockPLCs);
  const [selectedPLCs, setSelectedPLCs] = useState<Set<string>>(new Set(["1"]));
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");

  const handleConfigUploaded = (config: PLCConfig) => {
    console.log('Adding new PLC config:', config);
    const newPLC: PLC = {
      ...config,
      id: Math.random().toString(36).substr(2, 9),
      status: "maintenance",
      last_checked: new Date(),
      is_connected: false,
      created_at: new Date(),
    };
    
    setPLCs(prev => [...prev, newPLC]);
    setIsUploadDialogOpen(false);
  };

  const handleConnectPLC = (plcId: string) => {
    console.log(`Connecting PLC ${plcId}`);
    setPLCs(prev => 
      prev.map(plc => 
        plc.id === plcId 
          ? { ...plc, is_connected: true, status: "active" as const }
          : plc
      )
    );
    setSelectedPLCs(prev => new Set(Array.from(prev).concat(plcId)));
  };

  const handleDisconnectPLC = (plcId: string) => {
    console.log(`Disconnecting PLC ${plcId}`);
    setPLCs(prev => 
      prev.map(plc => 
        plc.id === plcId 
          ? { ...plc, is_connected: false, status: "maintenance" as const }
          : plc
      )
    );
    setSelectedPLCs(prev => {
      const newSet = new Set(prev);
      newSet.delete(plcId);
      return newSet;
    });
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
                  data={mockNodeData}
                  onExportCSV={() => console.log('Export CSV from dashboard')}
                  onRefresh={() => console.log('Refresh data from dashboard')}
                />
              ) : (
                <div className="text-center py-24 text-muted-foreground">
                  <div className="space-y-4">
                    <h3 className="text-xl font-medium">No PLCs Connected</h3>
                    <p className="text-sm max-w-md mx-auto">
                      Connect to one or more PLCs from the sidebar to start monitoring live data.
                      You can also add new PLC configurations using the "Add New" button.
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