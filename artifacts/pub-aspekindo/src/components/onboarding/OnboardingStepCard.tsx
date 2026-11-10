import { motion } from "framer-motion";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Rocket } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface OnboardingStep {
  id: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  description: string;
  color: string;
  iconBg: string;
  tips: string[];
  route: string;
  illustration: React.ReactNode;
}

interface OnboardingStepCardProps {
  step: OnboardingStep;
  isFirst: boolean;
  isLast: boolean;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
  onVisit: () => void;
}

export default function OnboardingStepCard({
  step,
  isFirst,
  isLast,
  onPrev,
  onNext,
  onFinish,
  onVisit,
}: OnboardingStepCardProps) {
  const Icon = step.icon;

  return (
    <Card className="overflow-hidden border-border/50 shadow-lg">
      {/* Illustration header */}
      <div className={`relative bg-gradient-to-br ${step.color} p-6 md:p-8`}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-4 w-32 h-32 rounded-full bg-white/20 blur-2xl" />
          <div className="absolute bottom-2 left-8 w-24 h-24 rounded-full bg-white/15 blur-xl" />
        </div>
        <div className="relative flex items-center gap-5">
          <motion.div
            initial={{ scale: 0.5, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
            className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg shrink-0"
          >
            <Icon className="w-8 h-8 md:w-10 md:h-10 text-white" />
          </motion.div>
          <div className="min-w-0">
            <motion.h1
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="text-xl md:text-2xl font-extrabold font-heading text-white leading-tight"
            >
              {step.title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="text-sm text-white/80 font-medium mt-1"
            >
              {step.subtitle}
            </motion.p>
          </div>
        </div>

        {/* Mini illustration */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-5"
        >
          {step.illustration}
        </motion.div>
      </div>

      {/* Body */}
      <div className="p-6 md:p-8">
        <p className="text-muted-foreground leading-relaxed mb-6 text-sm md:text-base">
          {step.description}
        </p>

        {/* Tips */}
        <div className="space-y-2.5 mb-6">
          {step.tips.map((tip, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.08 }}
              className="flex items-start gap-3 bg-muted/50 rounded-lg p-3"
            >
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span className="text-sm text-foreground">{tip}</span>
            </motion.div>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={onPrev}
            disabled={isFirst}
            className="gap-1"
            size="sm"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali
          </Button>

          {!isLast && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onVisit}
              className="text-xs text-muted-foreground hover:text-primary hidden sm:flex"
            >
              Lihat halaman <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          )}

          {isLast ? (
            <Button
              onClick={onFinish}
              className="bg-gradient-to-r from-pub-amber to-pub-amber-light text-accent-foreground font-heading shadow-amber hover:brightness-110 gap-1"
              size="sm"
            >
              Mulai Sekarang <Rocket className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={onNext} className="gap-1" size="sm">
              Lanjut <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
