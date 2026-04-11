import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle, XCircle, Copy, Send, AlertCircle, MessageSquare } from "lucide-react";

interface StatsProps {
  totalContacts: number;
  validContacts: number;
  invalidContacts: number;
  duplicatesRemoved: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  repliesCount: number;
  onStatClick?: (tab: string) => void;
}

export function DashboardStats({
  totalContacts,
  validContacts,
  invalidContacts,
  duplicatesRemoved,
  sentCount,
  failedCount,
  pendingCount,
  repliesCount,
  onStatClick,
}: StatsProps) {
  const stats = [
    { title: "Total Contacts", value: totalContacts, icon: Users, color: "text-blue-600", tab: "contacts" },
    { title: "Valid Numbers", value: validContacts, icon: CheckCircle, color: "text-green-600", tab: "contacts" },
    { title: "Invalid Numbers", value: invalidContacts, icon: XCircle, color: "text-red-600", tab: "contacts" },
    { title: "Duplicates Removed", value: duplicatesRemoved, icon: Copy, color: "text-orange-600", tab: "import" },
    { title: "Messages Sent", value: sentCount, icon: Send, color: "text-emerald-600", tab: "logs" },
    { title: "Messages Failed", value: failedCount, icon: AlertCircle, color: "text-rose-600", tab: "logs" },
    { title: "Messages Pending", value: pendingCount, icon: MessageSquare, color: "text-amber-600", tab: "logs" },
    { title: "Replies Received", value: repliesCount, icon: MessageSquare, color: "text-indigo-600", tab: "logs" },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, i) => (
        <Card 
          key={`${stat.title}-${i}`} 
          className={`border-none shadow-sm bg-white/50 backdrop-blur-sm transition-all hover:shadow-md hover:bg-white cursor-pointer group`}
          onClick={() => onStatClick?.(stat.tab)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-slate-900 transition-colors">
              {stat.title}
            </CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color} transition-transform group-hover:scale-110`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
