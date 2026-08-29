import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  previousValue?: string;
  percentageChange?: number;
  secondaryValue?: string;
  secondaryLabel?: string;
  extraInfo?: string;
}

const MetricCard = ({ 
  title, 
  value, 
  icon: Icon, 
  previousValue, 
  percentageChange,
  secondaryValue,
  secondaryLabel,
  extraInfo
}: MetricCardProps) => {
  const isPositive = percentageChange !== undefined && percentageChange >= 0;
  
  return (
    <Card className="card-hover min-w-0 border-border/80 bg-card/90 shadow-lg shadow-black/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2.5 pb-1.5 md:p-3 md:pb-1.5">
        <CardTitle className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground md:text-[11px]">
          {title}
        </CardTitle>
        <div className="rounded-md bg-primary/10 p-1.5">
          <Icon className="h-3 w-3 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="space-y-1 p-2.5 pt-0 md:p-3 md:pt-0">
        <div className="truncate text-base font-bold tracking-tight md:text-lg">{value}</div>
        
        {secondaryValue && (
          <p className="truncate text-[10px] text-muted-foreground/60">
            {secondaryLabel}: {secondaryValue}
          </p>
        )}
        
        {extraInfo && (
          <p className="text-[10px] text-muted-foreground/70">
            {extraInfo}
          </p>
        )}
        
        {previousValue && percentageChange !== undefined && (
          <div className="mt-1 flex items-center gap-1 text-[10px]">
            <span className="hidden text-muted-foreground/60 xl:inline">
              Ant: {previousValue}
            </span>
            <div className={`flex items-center gap-0.5 font-medium ${
              isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              {isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{Math.abs(percentageChange).toFixed(1)}%</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MetricCard;
