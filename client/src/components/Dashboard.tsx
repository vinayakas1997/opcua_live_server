import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { OpcuaNodesTable } from "./OpcuaNodesTable";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { type NodeData, type PLC } from "@shared/schema";

export default function Dashboard() {
  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">OPC UA Dashboard</h1>
            <p className="text-muted-foreground">
              View and manage OPC UA nodes stored in SQLite database
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-6">
        <OpcuaNodesTable />
      </div>
    </div>
  );
}
