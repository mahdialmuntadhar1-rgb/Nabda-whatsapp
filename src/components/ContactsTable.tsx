import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Contact } from "@/lib/supabase";
import { format } from "date-fns";

export function ContactsTable({ contacts }: { contacts: Contact[] }) {
  return (
    <div className="rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Governorate</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Added</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                No contacts found. Import some to get started.
              </TableCell>
            </TableRow>
          ) : (
            contacts.map((contact, i) => (
              <TableRow key={`${contact.id}-${i}`}>
                <TableCell className="font-medium">{contact.display_name}</TableCell>
                <TableCell className="font-mono text-xs">{contact.normalized_phone}</TableCell>
                <TableCell>{contact.governorate || "-"}</TableCell>
                <TableCell>{contact.category || "-"}</TableCell>
                <TableCell>
                  <Badge variant={contact.validity_status === "valid" ? "default" : "destructive"}>
                    {contact.validity_status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {format(new Date(contact.created_at), "MMM d, yyyy")}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
