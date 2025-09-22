import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Plus, Search, LayoutDashboard, Server } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppSidebar } from "./AppSidebar";
import LanguageSwitcher from "./LanguageSwitcher";
import JsonUploader from "./JsonUploader";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import { socketManager } from "@/lib/socket";
import { useToast } from "@/hooks/use-toast";
import { type PLCConfig, type PLC, type NodeData } from "@shared/schema";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [selectedPLCs, setSelectedPLCs] = useState<Set<string>>(new Set());
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [nodeData, setNodeData] = useState<NodeData[]>([]);
  
  const [location, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();

  // Get current page from route
  const currentPage = location === '/servers' ? 'servers' : 'dashboard';

  // Fetch PLCs
  const { data: plcs = [] } = useQuery({
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
        title: t("serverConnected"),
        description: `${t("success")}: ${updatedPLC.plc_name}`,
      });
    },
    onError: (error) => {
      toast({
        title: t("connectionFailed"),
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
        title: t("serverDisconnected"),
        description: `${t("disconnected")}: ${updatedPLC.plc_name}`,
      });
    },
    onError: (error) => {
      toast({
        title: t("connectionFailed"),
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
        title: t("plcAdded"),
        description: t("plcAddedSuccess"),
      });
    },
    onError: (error) => {
      toast({
        title: t("plcAddFailed"),
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

  // Custom sidebar width for better content layout
  const style = {
    "--sidebar-width": "20rem",       // 320px for better content
    "--sidebar-width-icon": "4rem",   // default icon width
  } as React.CSSProperties;

  const handleTabChange = (value: string) => {
    if (value === 'servers') {
      navigate('/servers');
    } else {
      navigate('/');
    }
  };

  return (
    <SidebarProvider style={style}>
      <div className="flex h-screen w-full">
        <AppSidebar
          plcs={plcs}
          selectedPLCs={selectedPLCs}
          onConnect={handleConnectPLC}
          onDisconnect={handleDisconnectPLC}
          onRefresh={(id) => console.log(`Refresh PLC ${id}`)}
          onConfigure={(id) => console.log(`Configure PLC ${id}`)}
        />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              
              <Tabs value={currentPage} onValueChange={handleTabChange}>
                <TabsList data-testid="tabs-navigation">
                  <TabsTrigger value="dashboard" data-testid="tab-dashboard">
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    {t("dashboard")}
                  </TabsTrigger>
                  <TabsTrigger value="servers" data-testid="tab-servers">
                    <Server className="w-4 h-4 mr-2" />
                    {t("opcuaServers")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {currentPage === 'dashboard' && (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder={t("search")}
                    value={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.value)}
                    className="w-64"
                    data-testid="input-global-search"
                  />
                  <Search className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-new">
                    <Plus className="w-4 h-4 mr-2" />
                    {t("addNew")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{t("uploadJsonConfig")}</DialogTitle>
                  </DialogHeader>
                  <JsonUploader
                    onConfigUploaded={handleConfigUploaded}
                    onClose={() => setIsUploadDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>
              
              <LanguageSwitcher />
            </div>
          </header>

          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}