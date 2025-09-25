import React from 'react';
import { OpcuaNodesTable } from './OpcuaNodesTable';

export function DatabasePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Database</h1>
          <p className="text-muted-foreground">
            View and manage OPC UA nodes stored in SQLite database
          </p>
        </div>
      </div>
      
      <OpcuaNodesTable />
    </div>
  );
}
