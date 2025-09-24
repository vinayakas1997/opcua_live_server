import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import { 
  Search, 
  Download, 
  RefreshCw, 
  ChevronDown, 
  ChevronRight,
  Eye,
  EyeOff,
  Save,
  Check
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  getParentVariables, 
  getChildVariables, 
  type NormalizedVariable,
  type NormalizedPLC 
} from "@shared/normalization";

interface EnhancedVariablesTableProps {
  plc?: NormalizedPLC;
  onExportCSV?: () => void;
  onRefresh?: () => void;
}

export default function EnhancedVariablesTable({ 
  plc,
  onExportCSV,
  onRefresh 
}: EnhancedVariablesTableProps) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVariables, setSelectedVariables] = useState<Set<string>>(new Set());
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userDescriptions, setUserDescriptions] = useState<Map<string, string>>(new Map());
  const [editingDescriptions, setEditingDescriptions] = useState<Set<string>>(new Set());
  const [savingDescriptions, setSavingDescriptions] = useState<Set<string>>(new Set());

  // Debug logging (cleaned up for production)
  // console.log('EnhancedVariablesTable - plc:', plc);
  // console.log('EnhancedVariablesTable - variables:', plc?.variables);
  // console.log('EnhancedVariablesTable - variables length:', plc?.variables?.length || 0);
  
  const variables = plc?.variables || [];
  const parentVariables = getParentVariables(variables);
  
  // Filter variables based on search term
  const filteredParentVariables = parentVariables.filter(variable => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      variable.plc_reg_add.toLowerCase().includes(searchLower) ||
      variable.opcua_reg_add.toLowerCase().includes(searchLower) ||
      variable.description.toLowerCase().includes(searchLower);
    
    if (showSelectedOnly) {
      // Show if parent is selected or any child is selected
      const childVariables = getChildVariables(variables, variable.id);
      const hasSelectedChild = childVariables.some(child => selectedVariables.has(child.id));
      return matchesSearch && (selectedVariables.has(variable.id) || hasSelectedChild);
    }
    
    return matchesSearch;
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    onRefresh?.();
    setTimeout(() => setIsRefreshing(false), 1000);
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
    const childVariables = getChildVariables(variables, channelId);
    
    if (checked) {
      newSelected.add(channelId);
      childVariables.forEach(child => newSelected.add(child.id));
    } else {
      newSelected.delete(channelId);
      childVariables.forEach(child => newSelected.delete(child.id));
    }
    setSelectedVariables(newSelected);
  };

  const toggleChannelExpanded = (channelId: string) => {
    const newExpanded = new Set(expandedChannels);
    if (newExpanded.has(channelId)) {
      newExpanded.delete(channelId);
    } else {
      newExpanded.add(channelId);
    }
    setExpandedChannels(newExpanded);
  };

  const isChannelExpanded = (channelId: string) => expandedChannels.has(channelId);

  const getVariableValue = (variable: NormalizedVariable) => {
    // Mock real-time values - in real implementation, this would come from live data
    if (variable.type === "bool") {
      return Math.random() > 0.5 ? "true" : "false";
    } else if (variable.type === "channel") {
      return Math.floor(Math.random() * 1000).toString();
    }
    return "N/A";
  };

  const getTimestamp = () => {
    return new Date().toLocaleTimeString('en-GB', { hour12: false });
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

  // Generate individual bit rows for BC (Boolean Channel) variables
  const generateBitRows = (variable: NormalizedVariable) => {
    if (!variable.opcua_reg_add.endsWith('_BC')) {
      return [];
    }

    // Check if variable has metadata with bit mappings (from uploaded config)
    if (variable.metadata?.bit_mappings) {
      return Object.entries(variable.metadata.bit_mappings).map(([bitKey, bitData]) => {
        const bitNumber = bitData.bit_position.toString().padStart(2, '0');
        const bitName = variable.opcua_reg_add.replace('_BC', `_BC_${bitNumber}`);
        
        return {
          ...variable,
          id: `${variable.id}_bit_${bitNumber}`,
          opcua_reg_add: bitName,
          description: bitData.description,
          type: "bool",
          isBitRow: true,
          parentId: variable.id,
          bitPosition: bitData.bit_position,
        };
      });
    }

    // Fallback: generate default bit rows for BC variables without metadata
    const defaultBitCount = 8;
    const bitRows = [];
    
    for (let bit = 0; bit < defaultBitCount; bit++) {
      const bitNumber = bit.toString().padStart(2, '0');
      const bitName = variable.opcua_reg_add.replace('_BC', `_BC_${bitNumber}`);
      
      bitRows.push({
        ...variable,
        id: `${variable.id}_bit_${bitNumber}`,
        opcua_reg_add: bitName,
        description: `Bit ${bitNumber} of ${variable.description}`,
        type: "bool",
        isBitRow: true,
        parentId: variable.id,
        bitPosition: bit,
      });
    }
    
    return bitRows;
  };

  const handleDescriptionEdit = (nodeId: string) => {
    const newEditing = new Set(editingDescriptions);
    newEditing.add(nodeId);
    setEditingDescriptions(newEditing);
  };

  const handleDescriptionSave = async (nodeId: string, description: string) => {
    if (!plc?.id) return;
    
    const newSaving = new Set(savingDescriptions);
    newSaving.add(nodeId);
    setSavingDescriptions(newSaving);

    try {
      const response = await fetch(`/api/plcs/${plc.id}/descriptions/${encodeURIComponent(nodeId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description }),
      });

      if (response.ok) {
        const newDescriptions = new Map(userDescriptions);
        newDescriptions.set(nodeId, description);
        setUserDescriptions(newDescriptions);
        
        const newEditing = new Set(editingDescriptions);
        newEditing.delete(nodeId);
        setEditingDescriptions(newEditing);
      }
    } catch (error) {
      console.error('Failed to save user description:', error);
    } finally {
      const newSaving = new Set(savingDescriptions);
      newSaving.delete(nodeId);
      setSavingDescriptions(newSaving);
    }
  };

  const handleDescriptionCancel = (nodeId: string) => {
    const newEditing = new Set(editingDescriptions);
    newEditing.delete(nodeId);
    setEditingDescriptions(newEditing);
  };

  const renderUserDescriptionCell = (variable: NormalizedVariable) => {
    const nodeId = variable.opcua_reg_add;
    const isEditing = editingDescriptions.has(nodeId);
    const isSaving = savingDescriptions.has(nodeId);
    const currentDescription = userDescriptions.get(nodeId) || '';

    if (isEditing) {
      return (
        <div className="flex items-center gap-2">
          <Input
            defaultValue={currentDescription}
            placeholder="Enter user description..."
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleDescriptionSave(nodeId, e.currentTarget.value);
              } else if (e.key === 'Escape') {
                handleDescriptionCancel(nodeId);
              }
            }}
            autoFocus
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              const input = e.currentTarget.parentElement?.querySelector('input');
              if (input) {
                handleDescriptionSave(nodeId, input.value);
              }
            }}
            disabled={isSaving}
          >
            {isSaving ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
          </Button>
        </div>
      );
    }

    return (
      <div 
        className="text-sm cursor-pointer hover:bg-muted/50 p-1 rounded min-h-[24px] flex items-center"
        onClick={() => handleDescriptionEdit(nodeId)}
        title="Click to edit user description"
      >
        {currentDescription || (
          <span className="text-muted-foreground italic">Click to add description...</span>
        )}
      </div>
    );
  };

  const selectedCount = selectedVariables.size;
  const totalVariables = variables.length;

  return (
    <div className="space-y-6" data-testid="enhanced-variables-table">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {t("variablesTable")} - PLC {plc?.plc_no || 1}
          </h2>
          <p className="text-muted-foreground">
            {t("totalVariables")}: {variables.length}
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
                const childVariables = getChildVariables(
                  variables,
                  variable.id,
                );
                const bitRows = generateBitRows(variable);
                const isExpanded = isChannelExpanded(variable.id);
                const isSelected = selectedVariables.has(variable.id);
                const hasChildren =
                  variable.type === "channel" && childVariables.length > 0;
                const hasBits = bitRows.length > 0;
                const statusBgColor = getStatusBackgroundColor("active");

                return (
                  <React.Fragment key={variable.id}>
                    <TableRow key={variable.id} className="group">
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            hasChildren || hasBits
                              ? handleChannelSelect(
                                  variable.id,
                                  checked as boolean,
                                )
                              : handleVariableSelect(
                                  variable.id,
                                  checked as boolean,
                                )
                          }
                          data-testid={`checkbox-variable-${variable.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        {(hasChildren || hasBits) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => toggleChannelExpanded(variable.id)}
                            aria-expanded={isExpanded}
                            data-testid={`button-expand-${variable.id}`}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
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

                    {/* Render bit rows for BC variables */}
                    {hasBits &&
                      isExpanded &&
                      bitRows.map((bitRow) => {
                        const isBitSelected = selectedVariables.has(bitRow.id);

                        return (
                          <TableRow
                            key={bitRow.id}
                            className="bg-muted/20 border-l-2 border-l-primary/20"
                          >
                            <TableCell>
                              <Checkbox
                                checked={isBitSelected}
                                onCheckedChange={(checked) =>
                                  handleVariableSelect(
                                    bitRow.id,
                                    checked as boolean,
                                  )
                                }
                                data-testid={`checkbox-bit-${bitRow.id}`}
                              />
                            </TableCell>
                            <TableCell className="pl-8">
                              <Badge variant="outline" className="text-xs">
                                {bitRow.bitPosition.toString().padStart(2, '0')}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium text-sm pl-8">
                              {bitRow.opcua_reg_add}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground w-32 truncate">
                              {bitRow.description}
                            </TableCell>
                            <TableCell className={`font-mono font-medium ${statusBgColor}`}>
                              {getVariableValue(bitRow)}
                            </TableCell>
                            <TableCell className={`font-mono text-xs text-muted-foreground ${statusBgColor}`}>
                              {getTimestamp()}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {bitRow.plc_reg_add}.{bitRow.bitPosition.toString().padStart(2, '0')}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {bitRow.type}
                            </TableCell>
                            <TableCell>
                              {renderUserDescriptionCell(bitRow)}
                            </TableCell>
                          </TableRow>
                        );
                      })}

                    {/* Render existing child variables */}
                    {hasChildren &&
                      isExpanded &&
                      childVariables.map((childVariable, index) => {
                        const isChildSelected = selectedVariables.has(
                          childVariable.id,
                        );

                        return (
                          <TableRow
                            key={childVariable.id}
                            className="bg-muted/20 border-l-2 border-l-primary/20"
                          >
                            <TableCell>
                              <Checkbox
                                checked={isChildSelected}
                                onCheckedChange={(checked) =>
                                  handleVariableSelect(
                                    childVariable.id,
                                    checked as boolean,
                                  )
                                }
                                data-testid={`checkbox-child-${childVariable.id}`}
                              />
                            </TableCell>
                            <TableCell className="pl-8">
                              <Badge variant="outline" className="text-xs">
                                {childVariable.bitPosition}
                              </Badge>
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
                    colSpan={9}
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