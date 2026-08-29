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
    <Card className="card-hover min-w-0">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6">
        <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="p-1.5 md:p-2 bg-primary/10 rounded-lg">
          <Icon className="h-3 w-3 md:h-4 md:w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="space-y-1 p-3 pt-0 md:p-6 md:pt-0">
        <div className="text-lg md:text-xl font-bold">{value}</div>
        
        {secondaryValue && (
          <p className="text-xs text-muted-foreground/50">
            {secondaryLabel}: {secondaryValue}
          </p>
        )}
        
        {extraInfo && (
          <p className="text-xs text-muted-foreground/70">
            {extraInfo}
          </p>
        )}
        
        {previousValue && percentageChange !== undefined && (
          <div className="flex items-center gap-1.5 text-xs mt-1">
            <span className="text-muted-foreground/60">
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
