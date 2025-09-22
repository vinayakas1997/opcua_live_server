import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Download, RefreshCw, Filter } from "lucide-react";
import { mockNodeData, type NodeData } from "@shared/schema";

interface LiveDataTableProps {
  data?: NodeData[];
  onExportCSV?: () => void;
  onRefresh?: () => void;
}

export default function LiveDataTable({ 
  data = mockNodeData, 
  onExportCSV,
  onRefresh 
}: LiveDataTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredData, setFilteredData] = useState(data);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Simulate real-time updates - todo: remove mock functionality
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date());
      // Simulate value changes
      const newData = data.map(item => ({
        ...item,
        current_value: typeof item.current_value === 'number' 
          ? item.current_value + (Math.random() - 0.5) * 2
          : item.current_value,
        timestamp: new Date(),
      }));
      setFilteredData(newData.filter(item => 
        item.node_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.node_id.toLowerCase().includes(searchTerm.toLowerCase())
      ));
    }, 1000);

    return () => clearInterval(interval);
  }, [data, searchTerm]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    console.log('Refreshing data...');
    onRefresh?.();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleExport = () => {
    console.log('Exporting CSV...');
    onExportCSV?.();
  };

  const formatValue = (value: any, dataType?: string) => {
    if (typeof value === 'number') {
      return dataType === 'Float' ? value.toFixed(2) : Math.round(value).toString();
    }
    return String(value);
  };

  const getQualityBadge = (quality?: string) => {
    if (!quality) return null;
    
    const variant = quality === 'Good' ? 'default' : 
                   quality === 'Uncertain' ? 'secondary' : 'destructive';
    
    return <Badge variant={variant} className="text-xs">{quality}</Badge>;
  };

  return (
    <Card data-testid="card-live-data">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Live Node Data
            <Badge variant="outline" className="font-mono text-xs">
              {filteredData.length} nodes
            </Badge>
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Last update: {lastUpdate.toLocaleTimeString()}
            </span>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing}
              data-testid="button-refresh-data"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExport}
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by node name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-filter-nodes"
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Node Name</TableHead>
                <TableHead>Node ID</TableHead>
                <TableHead>Current Value</TableHead>
                <TableHead>Data Type</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody data-testid="table-node-data">
              {filteredData.map((item, index) => (
                <TableRow key={`${item.node_id}-${index}`}>
                  <TableCell className="font-medium">
                    {item.node_name}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {item.node_id}
                  </TableCell>
                  <TableCell className="font-mono font-medium">
                    {formatValue(item.current_value, item.data_type)}
                  </TableCell>
                  <TableCell>
                    {item.data_type && (
                      <Badge variant="outline" className="text-xs">
                        {item.data_type}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {getQualityBadge(item.quality)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {item.timestamp.toLocaleTimeString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredData.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <div className="space-y-2">
                <p className="text-lg">No data found</p>
                <p className="text-sm">
                  {searchTerm ? "Try adjusting your filter terms" : "No node data available"}
                </p>
              </div>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}