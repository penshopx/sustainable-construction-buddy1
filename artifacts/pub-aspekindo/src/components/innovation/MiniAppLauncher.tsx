import { lazy, Suspense, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AppWindow, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { miniAppRegistry } from "./mini-app-registry";

// Lazy-loaded mini app components
const BidCalculator = lazy(() => import("./BidCalculator"));
const CashflowStressTest = lazy(() => import("./CashflowStressTest"));
const MarginLeakScanner = lazy(() => import("./MarginLeakScanner"));
const FuelLossTracker = lazy(() => import("./FuelLossTracker"));
const SurvivalSimulator = lazy(() => import("./SurvivalSimulator"));
const ProductivityChecker = lazy(() => import("./ProductivityChecker"));
const DustNoiseIndex = lazy(() => import("./DustNoiseIndex"));
const RetentionPlanner = lazy(() => import("./RetentionPlanner"));
const MultiProjectRadar = lazy(() => import("./MultiProjectRadar"));
const ContractTrapScanner = lazy(() => import("./ContractTrapScanner"));
const TenderRiskScorecard = lazy(() => import("./TenderRiskScorecard"));
const ResourceClashDetector = lazy(() => import("./ResourceClashDetector"));
const HiddenDelayCalculator = lazy(() => import("./HiddenDelayCalculator"));
const ScheduleBufferAnalyzer = lazy(() => import("./ScheduleBufferAnalyzer"));
const CostDriftAlarm = lazy(() => import("./CostDriftAlarm"));
const VODefenseTracker = lazy(() => import("./VODefenseTracker"));
const ReworkCostCalculator = lazy(() => import("./ReworkCostCalculator"));
const TheftImpactCalculator = lazy(() => import("./TheftImpactCalculator"));
const SiteSecurityScorer = lazy(() => import("./SiteSecurityScorer"));
const AssetDepreciationTracker = lazy(() => import("./AssetDepreciationTracker"));
const CarbonCostTool = lazy(() => import("./CarbonCostTool"));
const EnvironmentalComplianceCheck = lazy(() => import("./EnvironmentalComplianceCheck"));
const LessonsPatternAnalyzer = lazy(() => import("./LessonsPatternAnalyzer"));
const DefectLiabilityTracker = lazy(() => import("./DefectLiabilityTracker"));
const FinalAccountChecker = lazy(() => import("./FinalAccountChecker"));
const PortfolioCashPlanner = lazy(() => import("./PortfolioCashPlanner"));
const ResourceAllocationMatrix = lazy(() => import("./ResourceAllocationMatrix"));
const DebtServiceCalculator = lazy(() => import("./DebtServiceCalculator"));
const BreakEvenAnalyzer = lazy(() => import("./BreakEvenAnalyzer"));
// New batch 1 mini-apps
const DailyProgressIntelligence = lazy(() => import("./DailyProgressIntelligence"));
const QualityInspectionApp = lazy(() => import("./QualityInspectionApp"));
const SupplierScorecard = lazy(() => import("./SupplierScorecard"));
const MaterialPriceForecast = lazy(() => import("./MaterialPriceForecast"));
const ProcurementTimingOptimizer = lazy(() => import("./ProcurementTimingOptimizer"));
const SkillGapAnalyzer = lazy(() => import("./SkillGapAnalyzer"));
const TrainingROICalculator = lazy(() => import("./TrainingROICalculator"));
const WorkforceOptimizer = lazy(() => import("./WorkforceOptimizer"));
const ProductivityBenchmark = lazy(() => import("./ProductivityBenchmark"));
const SmartDocumentControl = lazy(() => import("./SmartDocumentControl"));
const AutoReportGenerator = lazy(() => import("./AutoReportGenerator"));
const WarrantyRiskTracker = lazy(() => import("./WarrantyRiskTracker"));

const componentMap: Record<string, React.LazyExoticComponent<React.ComponentType<Record<string, never>>>> = {
  "bid-calculator": BidCalculator,
  "cashflow-stress": CashflowStressTest,
  "margin-leak": MarginLeakScanner,
  "fuel-loss": FuelLossTracker,
  "survival-sim": SurvivalSimulator,
  "productivity-checker": ProductivityChecker,
  "dust-noise": DustNoiseIndex,
  "retention-planner": RetentionPlanner,
  "multi-project-radar": MultiProjectRadar,
  "contract-trap": ContractTrapScanner,
  "tender-scorecard": TenderRiskScorecard,
  "resource-clash": ResourceClashDetector,
  "hidden-delay": HiddenDelayCalculator,
  "schedule-buffer": ScheduleBufferAnalyzer,
  "cost-drift": CostDriftAlarm,
  "vo-defense": VODefenseTracker,
  "rework-cost": ReworkCostCalculator,
  "theft-impact": TheftImpactCalculator,
  "site-security": SiteSecurityScorer,
  "asset-depreciation": AssetDepreciationTracker,
  "carbon-cost": CarbonCostTool,
  "env-compliance": EnvironmentalComplianceCheck,
  "lessons-pattern": LessonsPatternAnalyzer,
  "defect-tracker": DefectLiabilityTracker,
  "final-account": FinalAccountChecker,
  "portfolio-cash": PortfolioCashPlanner,
  "resource-allocation": ResourceAllocationMatrix,
  "debt-service": DebtServiceCalculator,
  "break-even": BreakEvenAnalyzer,
  // New batch 1
  "daily-progress": DailyProgressIntelligence,
  "quality-inspection": QualityInspectionApp,
  "supplier-scorecard": SupplierScorecard,
  "material-forecast": MaterialPriceForecast,
  "procurement-timing": ProcurementTimingOptimizer,
  "skill-gap": SkillGapAnalyzer,
  "training-roi": TrainingROICalculator,
  "workforce-optimizer": WorkforceOptimizer,
  "productivity-benchmark": ProductivityBenchmark,
  "smart-docs": SmartDocumentControl,
  "auto-report": AutoReportGenerator,
  "warranty-tracker": WarrantyRiskTracker,
};

export function MiniAppLauncher({ appId, children }: { appId: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const app = miniAppRegistry.find(a => a.id === appId);
  const Component = componentMap[appId];

  if (!app || !Component) return null;

  return (
    <>
      {children ? (
        <span onClick={() => setOpen(true)} className="cursor-pointer">{children}</span>
      ) : (
        <Button onClick={() => setOpen(true)} className="gap-2" size="sm">
          <AppWindow className="w-4 h-4" /> Buka {app.name}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">{app.name}</DialogTitle>
          </DialogHeader>
          <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
            <Component />
          </Suspense>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function MiniAppGrid({ categorySlug }: { categorySlug: string }) {
  const apps = miniAppRegistry.filter(a => a.categorySlug === categorySlug);
  if (apps.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-base font-bold font-heading flex items-center gap-2">
        <AppWindow className="w-5 h-5 text-pub-emerald" /> Mini Apps Tersedia ({apps.length})
      </h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {apps.map((app) => (
          <MiniAppLauncher key={app.id} appId={app.id}>
            <Card className="cursor-pointer hover:shadow-card-hover transition-all border-pub-emerald/20 hover:border-pub-emerald/40 group">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-pub-emerald/10 flex items-center justify-center shrink-0 group-hover:bg-pub-emerald/20 transition-colors">
                  <AppWindow className="w-5 h-5 text-pub-emerald" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{app.name}</p>
                  <p className="text-xs text-muted-foreground">{app.description}</p>
                </div>
                <Button variant="outline" size="sm" className="shrink-0 text-xs gap-1 text-pub-emerald border-pub-emerald/30 hover:bg-pub-emerald/10">
                  Buka
                </Button>
              </CardContent>
            </Card>
          </MiniAppLauncher>
        ))}
      </div>
    </div>
  );
}
