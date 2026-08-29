import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface BinanceAd {
  advertiserName: string;
  price: string;
  minLimit: string;
  maxLimit: string;
  available: string;
  paymentMethods: string[];
  completionRate: string;
  orderCount: number;
  tradeType: "BUY" | "SELL";
}

const BinanceP2PWidget = () => {
  const [tradeType, setTradeType] = useState<"BUY" | "SELL">("BUY");
  const [ads, setAds] = useState<BinanceAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchAds = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.binanceP2P({ tradeType, fiat: "USD", asset: "USDT", rows: 15 });

      if (data?.success && data?.ads) {
        setAds(data.ads as BinanceAd[]);
        setLastUpdate(new Date());
      } else {
        throw new Error("No se recibieron datos válidos");
      }
    } catch (error) {
      console.error('Error fetching Binance P2P ads:', error);
      toast.error(getErrorMessage(error, "Error al cargar cotizaciones de Binance P2P"));
    } finally {
      setLoading(false);
    }
  }, [tradeType]);

  useEffect(() => {
    fetchAds();
    
    // Auto-refresh cada 60 segundos
    const interval = setInterval(fetchAds, 60000);
    return () => clearInterval(interval);
  }, [fetchAds]);

  const bestPrice = ads.length > 0 ? parseFloat(ads[0].price) : 0;
  const worstPrice = ads.length > 0 ? parseFloat(ads[ads.length - 1]?.price || ads[0].price) : 0;
  const spread = bestPrice && worstPrice ? ((Math.abs(worstPrice - bestPrice) / bestPrice) * 100).toFixed(2) : "0";

  const getTimeAgo = () => {
    if (!lastUpdate) return "";
    const seconds = Math.floor((new Date().getTime() - lastUpdate.getTime()) / 1000);
    if (seconds < 60) return `Hace ${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `Hace ${minutes}m`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Binance P2P - USDT/USD</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Cotizaciones en tiempo real
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              <Button
                variant={tradeType === "BUY" ? "default" : "ghost"}
                size="sm"
                onClick={() => setTradeType("BUY")}
                className="gap-2"
              >
                <TrendingDown className="h-4 w-4" />
                Vender USDT
              </Button>
              <Button
                variant={tradeType === "SELL" ? "default" : "ghost"}
                size="sm"
                onClick={() => setTradeType("SELL")}
                className="gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                Comprar USDT
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAds}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {getTimeAgo()}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Resumen */}
        {!loading && ads.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Mejor precio</p>
              <p className="text-2xl font-bold text-primary">${bestPrice.toFixed(3)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Precio promedio</p>
              <p className="text-2xl font-bold">
                ${(ads.reduce((sum, ad) => sum + parseFloat(ad.price), 0) / ads.length).toFixed(3)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Spread</p>
              <p className="text-2xl font-bold text-muted-foreground">{spread}%</p>
            </div>
          </div>
        )}

        {/* Tabla de anunciantes */}
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anunciante</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Límites</TableHead>
                  <TableHead className="text-right">Disponible</TableHead>
                  <TableHead>Métodos de Pago</TableHead>
                  <TableHead className="text-center">Completadas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : ads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No hay anuncios disponibles
                    </TableCell>
                  </TableRow>
                ) : (
                  ads.map((ad, index) => (
                    <TableRow key={index} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {ad.advertiserName}
                          {index === 0 && <span className="text-yellow-500">⭐</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        ${parseFloat(ad.price).toFixed(3)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        ${parseFloat(ad.minLimit).toLocaleString()} - ${parseFloat(ad.maxLimit).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {parseFloat(ad.available).toLocaleString()} USDT
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {ad.paymentMethods.slice(0, 3).map((method, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {method}
                            </Badge>
                          ))}
                          {ad.paymentMethods.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{ad.paymentMethods.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`font-semibold ${parseFloat(ad.completionRate) >= 95 ? 'text-green-500' : parseFloat(ad.completionRate) >= 90 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                            {ad.completionRate}%
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({ad.orderCount})
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-4 text-center">
          {tradeType === "BUY" 
            ? "Mostrando anuncios para COMPRAR USDT (pagando USD)" 
            : "Mostrando anuncios para VENDER USDT (recibiendo USD)"}
        </p>
      </CardContent>
    </Card>
  );
};

export default BinanceP2PWidget;
