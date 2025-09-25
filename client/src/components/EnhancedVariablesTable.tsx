import React, { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, RefreshCw, Download, Eye, EyeOff, Edit2, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type NormalizedPLC, type NormalizedVariable } from "@shared/normalization";

interface EnhancedVariablesTableProps {
  plc: NormalizedPLC | null;
  onExportCSV: () => void;
  onRefresh: () => void;
}

export default function EnhancedVariablesTable({ 
  plc,
  onExportCSV,
  onRefresh 
}: EnhancedVariablesTableProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVariables, setSelectedVariables] = useState<Set<string>>(new Set());
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userDescriptions, setUserDescriptions] = useState<Map<string, string>>(new Map());
  const [editingDescriptions, setEditingDescriptions] = useState<Set<string>>(new Set());
  const [savingDescriptions, setSavingDescriptions] = useState<Set<string>>(new Set());

  // Get variables from plc, default to empty array if not available
  const variables = plc?.variables || [];

  // Transform variables to include expanded bit rows
  const transformedVariables = variables.flatMap(variable => {
    // Check if this is a bit-mapped channel (BC type with bit_mappings)
    if (variable.opcua_reg_add?.endsWith('_BC') && variable.metadata?.bit_mappings) {
      // Create separate rows for each bit mapping
      return Object.entries(variable.metadata.bit_mappings).map(([bitKey, bitData]: [string, any]) => {
        const bitNumber = bitData?.bit_position?.toString().padStart(2, '0') || '00';
        const bitName = variable.opcua_reg_add.replace('_BC', `_${bitNumber}`);

        return {
          ...variable,
          id: `${variable.id}_bit_${bitNumber}`,
          opcua_reg_add: bitName,
          plc_reg_add: `${variable.plc_reg_add}_${bitNumber}`,
          description: bitData?.description || `${variable.description} - Bit ${bitNumber}`,
          type: "bool" as const,
          isBitRow: true,
          parentId: variable.id,
          bitPosition: bitData?.bit_position || 0,
        };
      });
    }
    // Return original variable if not a bit-mapped channel
    return [variable];
  });

  const getParentVariables = (vars: NormalizedVariable[]) => {
    return vars.filter(v => v.type === "channel" || !v.parentId);
  };

  const getChildVariables = (vars: NormalizedVariable[], parentId: string) => {
    return vars.filter(v => v.parentId === parentId);
  };

  const parentVariables = getParentVariables(transformedVariables);

  // Filter variables based on search term
  const filteredParentVariables = parentVariables.filter(variable => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      variable.plc_reg_add?.toLowerCase().includes(searchLower) ||
      variable.opcua_reg_add?.toLowerCase().includes(searchLower) ||
      variable.description?.toLowerCase().includes(searchLower);
    
    if (showSelectedOnly) {
      // Show if parent is selected or any child is selected
      const childVariables = getChildVariables(transformedVariables, variable.id);
      const hasSelectedChild = childVariables.some(child => selectedVariables.has(child.id));
      return matchesSearch && (selectedVariables.has(variable.id) || hasSelectedChild);
    }
    
    return matchesSearch;
  });

  // Load user descriptions on component mount
  useEffect(() => {
    const loadUserDescriptions = async () => {
      try {
        const response = await fetch('/api/user-descriptions');
        if (response.ok) {
          const descriptions = await response.json();
          setUserDescriptions(descriptions);
        }
      } catch (error) {
        // Silently handle the error since this is expected in development
      }
    };

    loadUserDescriptions();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
      toast({
        title: t("refreshing"),
        description: t("dataRefreshed"),
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh data",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleVariableSelect = (variableId: string, checked: boolean) => {
    const newSelected = new Set(selectedVariables);
    if (checked) {
      newSelected.add(variableId);
    } else {
      newSelected.delete(variableId);
    }
    setSelectedVariables(newSelected);
  };

  const handleChannelSelect = (channelId: string, checked: boolean) => {
    const newSelected = new Set(selectedVariables);
    const childVariables = getChildVariables(transformedVariables, channelId);
    
    if (checked) {
      newSelected.add(channelId);
      childVariables.forEach(child => newSelected.add(child.id));
    } else {
      newSelected.delete(channelId);
      childVariables.forEach(child => newSelected.delete(child.id));
    }
    setSelectedVariables(newSelected);
  };

  const getVariableValue = (variable: NormalizedVariable) => {
    // Mock value for demonstration
    if (variable.type === "bool") return "true";
    if (variable.type === "channel") return "N/A";
    return "N/A";
  };

  const getTimestamp = () => {
    return new Date().toLocaleTimeString();
  };

  const getStatusBackgroundColor = (status: string) => {
    return "bg-green-50 dark:bg-green-950/20";
  };

  const renderUserDescriptionCell = (variable: NormalizedVariable) => {
    const isEditing = editingDescriptions.has(variable.id);
    const isSaving = savingDescriptions.has(variable.id);
    const userDescription = userDescriptions.get(variable.id) || "";

    if (isEditing) {
      return (
        <div className="flex items-center gap-2">
          <Input
            defaultValue={userDescription}
            className="h-8 text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                // Save logic would go here
                setEditingDescriptions(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(variable.id);
                  return newSet;
                });
              }
              if (e.key === 'Escape') {
                setEditingDescriptions(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(variable.id);
                  return newSet;
                });
              }
            }}
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            disabled={isSaving}
            onClick={() => {
              setEditingDescriptions(prev => {
                const newSet = new Set(prev);
                newSet.delete(variable.id);
                return newSet;
              });
            }}
          >
            <Save className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => {
              setEditingDescriptions(prev => {
                const newSet = new Set(prev);
                newSet.delete(variable.id);
                return newSet;
              });
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 group">
        <span className="text-xs text-muted-foreground truncate flex-1">
          {userDescription || "Add description..."}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
          onClick={() => {
            setEditingDescriptions(prev => new Set(prev).add(variable.id));
          }}
        >
          <Edit2 className="h-3 w-3" />
        </Button>
      </div>
    );
  };

  const selectedCount = selectedVariables.size;
  const totalVariables = transformedVariables.length;

  return (
    <div className="space-y-6" data-testid="enhanced-variables-table">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {t("variablesTable")} - PLC {plc?.plc_no || 1}
          </h2>
          <p className="text-muted-foreground">
            {t("totalVariables")}: {transformedVariables.length}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            data-testid="button-refresh-variables"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          
          <Button 
            variant="default" 
            size="sm" 
            onClick={onExportCSV}
            className="bg-green-600 text-white"
            data-testid="button-export-variables"
          >
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`${t("search")} ${t("variables").toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-variables"
          />
        </div>
        
        <Button
          variant={showSelectedOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setShowSelectedOnly(!showSelectedOnly)}
          className="gap-2"
          data-testid="button-toggle-selected"
        >
          {showSelectedOnly ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          {showSelectedOnly ? t("showAll") : t("showSelected")}
        </Button>
      </div>

      {/* Table Section */}
      <div className="border rounded-lg bg-background">
        <ScrollArea className="h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 text-left"></TableHead>
                <TableHead className="text-left">{t("nodeName")}</TableHead>
                <TableHead className="text-left w-32">{t("description")}</TableHead>
                <TableHead className="text-left">{t("value")}</TableHead>
                <TableHead className="text-left">{t("timestamp")}</TableHead>
                <TableHead className="text-left">{t("address")}</TableHead>
                <TableHead className="text-left">Data Type</TableHead>
                <TableHead className="text-left">{t("userDescription")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody data-testid="table-variables-body">
              {filteredParentVariables.map((variable) => {
                const childVariables = getChildVariables(transformedVariables, variable.id);
                const isSelected = selectedVariables.has(variable.id);
                const hasChildren = variable.type === "channel" && childVariables.length > 0;
                const statusBgColor = getStatusBackgroundColor("active");
                const isBitRow = variable.isBitRow;

                return (
                  <React.Fragment key={variable.id}>
                    <TableRow className={`group ${isBitRow ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            hasChildren
                              ? handleChannelSelect(variable.id, checked as boolean)
                              : handleVariableSelect(variable.id, checked as boolean)
                          }
                          data-testid={`checkbox-variable-${variable.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {isBitRow && (
                          <Badge variant="outline" className="text-xs mr-2">
                            Bit {(variable.bitPosition?.toString() || '0').padStart(2, '0')}
                          </Badge>
                        )}
                        {variable.opcua_reg_add}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground w-32 truncate">
                        {variable.description}
                      </TableCell>
                      <TableCell className={`font-mono font-medium ${statusBgColor}`}>
                        {getVariableValue(variable)}
                      </TableCell>
                      <TableCell className={`font-mono text-xs text-muted-foreground ${statusBgColor}`}>
                        {getTimestamp()}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {variable.plc_reg_add}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {variable.type}
                      </TableCell>
                      <TableCell>
                        {renderUserDescriptionCell(variable)}
                      </TableCell>
                    </TableRow>

                    {/* Render existing child variables if any */}
                    {hasChildren &&
                      childVariables.map((childVariable) => {
                        const isChildSelected = selectedVariables.has(childVariable.id);

                        return (
                          <TableRow
                            key={childVariable.id}
                            className="bg-muted/20 border-l-2 border-l-primary/20"
                          >
                            <TableCell>
                              <Checkbox
                                checked={isChildSelected}
                                onCheckedChange={(checked) =>
                                  handleVariableSelect(childVariable.id, checked as boolean)
                                }
                                data-testid={`checkbox-child-${childVariable.id}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium text-sm pl-8">
                              {childVariable.opcua_reg_add}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground w-32 truncate">
                              {childVariable.description}
                            </TableCell>
                            <TableCell className={`font-mono font-medium ${statusBgColor}`}>
                              {getVariableValue(childVariable)}
                            </TableCell>
                            <TableCell className={`font-mono text-xs text-muted-foreground ${statusBgColor}`}>
                              {getTimestamp()}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {childVariable.plc_reg_add}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {childVariable.type}
                            </TableCell>
                            <TableCell>
                              {renderUserDescriptionCell(childVariable)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </React.Fragment>
                );
              })}
              
              {filteredParentVariables.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {searchTerm ? t("noMatchingVariables") : t("noData")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  );
}