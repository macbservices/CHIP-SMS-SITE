import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  LogOut,
  MapPin,
  Plus,
  Smartphone,
  Signal,
  Wifi,
  WifiOff,
  Copy,
  Trash2,
  RefreshCw,
} from "lucide-react";

type Location = {
  id: string;
  name: string;
  description: string | null;
  api_key: string;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
};

type Modem = {
  id: string;
  location_id: string;
  port_name: string;
  imei: string | null;
  operator: string | null;
  signal_strength: number | null;
  status: string;
  last_seen_at: string | null;
};

type Chip = {
  id: string;
  modem_id: string;
  phone_number: string;
  iccid: string | null;
  operator: string | null;
  status: string;
  detected_at: string;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Location[]>([]);
  const [modems, setModems] = useState<Modem[]>([]);
  const [chips, setChips] = useState<Chip[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationDesc, setNewLocationDesc] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    fetchLocations();
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      fetchModems(selectedLocation);
    }
  }, [selectedLocation]);

  useEffect(() => {
    // Realtime subscription for modems
    const channel = supabase
      .channel("modems-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "modems" },
        () => {
          if (selectedLocation) fetchModems(selectedLocation);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chips" },
        () => {
          if (selectedLocation) fetchModems(selectedLocation);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedLocation]);

  const checkAuth = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) navigate("/auth");
  };

  const fetchLocations = async () => {
    const { data, error } = await supabase
      .from("locations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar localizações");
      return;
    }
    setLocations(data || []);
    if (data && data.length > 0 && !selectedLocation) {
      setSelectedLocation(data[0].id);
    }
    setLoading(false);
  };

  const fetchModems = async (locationId: string) => {
    const { data: modemData } = await supabase
      .from("modems")
      .select("*")
      .eq("location_id", locationId)
      .order("port_name");

    setModems(modemData || []);

    if (modemData && modemData.length > 0) {
      const modemIds = modemData.map((m) => m.id);
      const { data: chipData } = await supabase
        .from("chips")
        .select("*")
        .in("modem_id", modemIds)
        .order("detected_at", { ascending: false });
      setChips(chipData || []);
    } else {
      setChips([]);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const createLocation = async () => {
    if (!newLocationName.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("locations").insert({
      name: newLocationName,
      description: newLocationDesc || null,
      user_id: user.id,
    });

    if (error) {
      toast.error("Erro ao criar localização");
      return;
    }

    toast.success("Localização criada!");
    setNewLocationName("");
    setNewLocationDesc("");
    setDialogOpen(false);
    fetchLocations();
  };

  const deleteLocation = async (id: string) => {
    const { error } = await supabase.from("locations").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Localização excluída");
    if (selectedLocation === id) setSelectedLocation(null);
    fetchLocations();
  };

  const copyApiKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("API Key copiada!");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "online":
        return <Badge className="bg-success text-success-foreground">Online</Badge>;
      case "offline":
        return <Badge variant="secondary">Offline</Badge>;
      case "error":
        return <Badge variant="destructive">Erro</Badge>;
      case "active":
        return <Badge className="bg-success text-success-foreground">Ativo</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inativo</Badge>;
      case "blocked":
        return <Badge variant="destructive">Bloqueado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const selectedLoc = locations.find((l) => l.id === selectedLocation);
  const locationModems = modems;
  const locationChips = chips;

  const totalOnline = modems.filter((m) => m.status === "online").length;
  const totalChips = chips.filter((c) => c.status === "active").length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Smartphone className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">CHIP SMS</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Localizações</p>
                <p className="text-2xl font-bold">{locations.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                <Wifi className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Modems Online</p>
                <p className="text-2xl font-bold">{totalOnline}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                <Signal className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Chips Ativos</p>
                <p className="text-2xl font-bold">{totalChips}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Locations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Localizações</CardTitle>
              <CardDescription>
                Gerencie os locais onde o app .exe está instalado
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Localização
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova Localização</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={newLocationName}
                      onChange={(e) => setNewLocationName(e.target.value)}
                      placeholder="Ex: Escritório SP"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição (opcional)</Label>
                    <Input
                      value={newLocationDesc}
                      onChange={(e) => setNewLocationDesc(e.target.value)}
                      placeholder="Detalhes do local"
                    />
                  </div>
                  <Button onClick={createLocation} className="w-full">
                    Criar Localização
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {locations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma localização cadastrada. Crie uma para começar.
              </p>
            ) : (
              <div className="space-y-2">
                {locations.map((loc) => (
                  <div
                    key={loc.id}
                    onClick={() => setSelectedLocation(loc.id)}
                    className={`flex items-center justify-between rounded-lg border p-4 cursor-pointer transition-colors ${
                      selectedLocation === loc.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${
                          loc.last_seen_at &&
                          Date.now() - new Date(loc.last_seen_at).getTime() < 300000
                            ? "bg-success animate-pulse-dot"
                            : "bg-muted-foreground"
                        }`}
                      />
                      <div>
                        <p className="font-medium">{loc.name}</p>
                        {loc.description && (
                          <p className="text-sm text-muted-foreground">
                            {loc.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyApiKey(loc.api_key);
                        }}
                        title="Copiar API Key"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteLocation(loc.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selected location details */}
        {selectedLoc && (
          <>
            {/* API Key info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  API Key — {selectedLoc.name}
                </CardTitle>
                <CardDescription>
                  Use esta chave no app .exe para autenticar nesta localização
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono break-all">
                    {selectedLoc.api_key}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyApiKey(selectedLoc.api_key)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Modems */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Modems</CardTitle>
                <CardDescription>
                  Chipeiras GSM detectadas nesta localização
                </CardDescription>
              </CardHeader>
              <CardContent>
                {locationModems.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                    <WifiOff className="h-10 w-10" />
                    <p>Nenhum modem conectado</p>
                    <p className="text-sm">
                      Inicie o app .exe neste local para ver os modems aqui
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Porta</TableHead>
                        <TableHead>IMEI</TableHead>
                        <TableHead>Operadora</TableHead>
                        <TableHead>Sinal</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Última vez</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {locationModems.map((modem) => (
                        <TableRow key={modem.id}>
                          <TableCell className="font-mono">
                            {modem.port_name}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {modem.imei || "—"}
                          </TableCell>
                          <TableCell>{modem.operator || "—"}</TableCell>
                          <TableCell>
                            {modem.signal_strength != null
                              ? `${modem.signal_strength}%`
                              : "—"}
                          </TableCell>
                          <TableCell>{getStatusBadge(modem.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {modem.last_seen_at
                              ? new Date(modem.last_seen_at).toLocaleString("pt-BR")
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Chips */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Chips / Números</CardTitle>
                <CardDescription>
                  Números identificados nos modems desta localização
                </CardDescription>
              </CardHeader>
              <CardContent>
                {locationChips.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                    <Smartphone className="h-10 w-10" />
                    <p>Nenhum chip detectado</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>ICCID</TableHead>
                        <TableHead>Operadora</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Detectado em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {locationChips.map((chip) => (
                        <TableRow key={chip.id}>
                          <TableCell className="font-mono font-medium">
                            {chip.phone_number}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {chip.iccid || "—"}
                          </TableCell>
                          <TableCell>{chip.operator || "—"}</TableCell>
                          <TableCell>{getStatusBadge(chip.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(chip.detected_at).toLocaleString("pt-BR")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
