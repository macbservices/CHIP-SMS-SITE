import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Smartphone, MapPin, Wifi, ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/dashboard");
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Smartphone className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">CHIP SMS</span>
          </div>
          <Button onClick={() => navigate("/auth")}>Entrar</Button>
        </div>
      </header>

      <main className="flex flex-1 items-center">
        <div className="container py-20">
          <div className="mx-auto max-w-2xl text-center space-y-6">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Gerencie seus chips GSM de qualquer lugar
            </h1>
            <p className="text-lg text-muted-foreground">
              Conecte suas chipeiras GSM em múltiplas localizações e monitore todos
              os números e modems em tempo real através do dashboard web.
            </p>
            <div className="flex justify-center gap-4">
              <Button size="lg" onClick={() => navigate("/auth")}>
                Começar agora
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <div className="mt-16 grid gap-8 sm:grid-cols-3">
              <div className="space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">Multi-localização</h3>
                <p className="text-sm text-muted-foreground">
                  Instale o app em quantos locais quiser, todos conectados ao
                  mesmo painel.
                </p>
              </div>
              <div className="space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                  <Wifi className="h-6 w-6 text-success" />
                </div>
                <h3 className="font-semibold">Tempo real</h3>
                <p className="text-sm text-muted-foreground">
                  Veja o status dos modems e chips atualizando em tempo real no
                  dashboard.
                </p>
              </div>
              <div className="space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
                  <Smartphone className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-semibold">Chips & SMS</h3>
                <p className="text-sm text-muted-foreground">
                  Identifique números, operadoras e monitore mensagens
                  recebidas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
