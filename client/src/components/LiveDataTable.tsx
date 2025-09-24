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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Download, RefreshCw, Filter, Database } from "lucide-react";
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

  // Get status-based background color
  const getStatusBackgroundColor = (status: string = "active") => {
    switch (status) {
      case "active":
        return "bg-green-100 dark:bg-green-900/20";
      case "maintenance":
        return "bg-yellow-100 dark:bg-yellow-900/20";
      case "error":
        return "bg-red-100 dark:bg-red-900/20";
      default:
        return "bg-green-100 dark:bg-green-900/20";
    }
  };

  const statusBgColor = getStatusBackgroundColor("active");

  return (
    <Card data-testid="card-live-data">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Live Data - PLC 1</CardTitle>
            <CardDescription>
              Real-time monitoring of PLC variables
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              data-testid="button-refresh-live-data"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onExportCSV}
              data-testid="button-export-live-data"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Node Name</TableHead>
                <TableHead className="w-32">Description</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Data Type</TableHead>
                <TableHead>User Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody data-testid="table-node-data">
              {filteredData.map((item, index) => (
                <TableRow key={`${item.node_id}-${index}`}>
                  <TableCell className="font-medium">
                    {item.node_name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground w-32 truncate">
                    {item.node_id}
                  </TableCell>
                  <TableCell className={`font-mono font-medium ${statusBgColor}`}>
                    {formatValue(item.current_value, item.data_type)}
                  </TableCell>
                  <TableCell className={`font-mono text-xs text-muted-foreground ${statusBgColor}`}>
                    {item.timestamp.toLocaleTimeString('en-GB', { hour12: false })}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {item.node_id}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.data_type}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground italic">
                    Click to add description...
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredData.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-3 mb-4">
                <Database className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
              <p className="text-muted-foreground mb-4 max-w-sm">
                No live data is currently available. Check your PLC connection or try refreshing.
              </p>
              <Button variant="outline" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Data
              </Button>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}