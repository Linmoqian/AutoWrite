import { Zap } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { OUTLINE_STEP_LABELS } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOutline } from "./hooks/use-outline";
import { LoadingView } from "./components/loading-view";
import { StepIndicator } from "./components/step-indicator";
import { OutlineContent } from "./components/outline-content";

export default function Outline() {
  const novelStatus = useAppStore((s) => s.novelStatus);

  const volumes = novelStatus?.outline ?? [];
  const world = novelStatus?.novel.worldView;
  const characters = novelStatus?.novel.characters;

  const {
    loading,
    currentStep,
    streamingText,
    setViewTab,
    availableSteps,
    activeTab,
    handleGenerate,
    streamRef,
  } = useOutline(world, characters, volumes);

  if (loading) {
    return (
      <LoadingView
        currentStep={currentStep}
        streamingText={streamingText}
        streamRef={streamRef}
      />
    );
  }

  const hasWorldOrChars = !!world || !!characters;
  const hasNothing = volumes.length === 0 && !hasWorldOrChars;

  if (hasNothing) {
    return (
      <div className="fade-in">
        <h1 className="page-title">大纲管理</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-12">
            <p className="text-muted-foreground">暂无大纲，请先生成</p>
            <Button onClick={handleGenerate}>
              <Zap className="mr-1.5 h-4 w-4" />
              生成大纲
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="page-title mb-0 pb-0">大纲管理</h1>
        <Button onClick={handleGenerate}>
          <Zap className="mr-1.5 h-4 w-4" />
          {hasNothing ? "生成大纲" : `重新生成${OUTLINE_STEP_LABELS[activeTab]}`}
        </Button>
      </div>

      <StepIndicator activeTab={activeTab} availableSteps={availableSteps} onTabChange={setViewTab} />

      <Card className="mt-4">
        <CardContent className="min-h-[200px] p-5">
          <OutlineContent
            activeTab={activeTab}
            world={world}
            characters={characters}
            volumes={volumes}
          />
        </CardContent>
      </Card>
    </div>
  );
}
