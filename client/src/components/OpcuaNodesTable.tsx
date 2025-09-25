import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Edit2, Save, X } from 'lucide-react';

interface OpcuaNode {
  id?: number;
  plc_no: number;
  nodeName: string;
  description: string;
  value: string;
  timestamp: string;
  datatype: string;
  regAdd: string;
  userDescription?: string;
}

export function OpcuaNodesTable() {
  const [nodes, setNodes] = useState<OpcuaNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNode, setEditingNode] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  // Fetch all OPC UA nodes
  const fetchNodes = async () => {
    try {
      const response = await fetch('/api/opcua-nodes');
      if (response.ok) {
        const data = await response.json();
        setNodes(data);
      }
    } catch (error) {
      console.error('Error fetching nodes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update user description
  const updateUserDescription = async (id: number, userDescription: string) => {
    try {
      const response = await fetch(`/api/opcua-nodes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userDescription }),
      });

      if (response.ok) {
        const updatedNode = await response.json();
        setNodes(prev => prev.map(node => 
          node.id === id ? updatedNode : node
        ));
        setEditingNode(null);
        setEditValue('');
      }
    } catch (error) {
      console.error('Error updating user description:', error);
    }
  };

  const startEditing = (node: OpcuaNode) => {
    setEditingNode(node.id || 0);
    setEditValue(node.userDescription || '');
  };

  const cancelEditing = () => {
    setEditingNode(null);
    setEditValue('');
  };

  const saveDescription = () => {
    if (editingNode !== null) {
      updateUserDescription(editingNode, editValue);
    }
  };

  useEffect(() => {
    fetchNodes();
  }, []);

  const getDataTypeBadgeColor = (datatype: string) => {
    switch (datatype.toLowerCase()) {
      case 'bool': return 'bg-green-100 text-green-800';
      case 'word': return 'bg-blue-100 text-blue-800';
      case 'channel': return 'bg-purple-100 text-purple-800';
      case 'udint': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>OPC UA Nodes</CardTitle>
          <CardDescription>Loading nodes from database...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>OPC UA Nodes Database</CardTitle>
        <CardDescription>
          Database: <code className="bg-gray-100 px-2 py-1 rounded">database.sqlite</code> | 
          Table: <code className="bg-gray-100 px-2 py-1 rounded">opcua_nodes</code> | 
          Total Nodes: <span className="font-semibold">{nodes.length}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {nodes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">No OPC UA nodes found in database</p>
            <p className="text-sm text-gray-400">Upload a JSON file to populate the database</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">PLC No</TableHead>
                  <TableHead>Node Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-20">Data Type</TableHead>
                  <TableHead>Reg Address</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>User Description</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nodes.map((node) => (
                  <TableRow key={node.id || node.plc_no}>
                    <TableCell className="font-mono text-sm">{node.plc_no}</TableCell>
                    <TableCell className="font-mono text-sm">{node.nodeName}</TableCell>
                    <TableCell className="max-w-xs truncate" title={node.description}>
                      {node.description}
                    </TableCell>
                    <TableCell>
                      <Badge className={getDataTypeBadgeColor(node.datatype)}>
                        {node.datatype}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{node.regAdd}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {node.value || <span className="text-gray-400">empty</span>}
                    </TableCell>
                    <TableCell className="min-w-48">
                      {editingNode === node.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            placeholder="Enter user description..."
                            className="text-sm"
                          />
                          <Button size="sm" onClick={saveDescription}>
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEditing}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm flex-1">
                            {node.userDescription || (
                              <span className="text-gray-400 italic">No description</span>
                            )}
                          </span>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => startEditing(node)}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {new Date(node.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={fetchNodes}>
                        Refresh
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
