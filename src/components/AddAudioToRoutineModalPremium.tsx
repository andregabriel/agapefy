"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { searchAudios, getCategories } from "@/lib/supabase-queries";
import type { Audio, Category } from "@/lib/supabase-queries";
import { useRoutinePlaylist } from "@/hooks/useRoutinePlaylist";
import { toast } from "sonner";
import {
  Check,
  Plus,
  Play,
  Search,
  X,
  Sparkles,
  Loader2,
} from "lucide-react";

interface AddAudioToRoutineModalPremiumProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAudioToRoutineModalPremium({
  open,
  onOpenChange,
}: AddAudioToRoutineModalPremiumProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [audios, setAudios] = useState<Audio[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  const { addAudioToRoutine, removeAudioFromRoutine, isAudioInRoutine } =
    useRoutinePlaylist();

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await getCategories();
        setCategories(data);
      } catch (error) {
        console.error("Erro ao carregar categorias:", error);
      }
    };

    loadCategories();
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const results = await searchAudios(
        searchTerm,
        selectedCategory || undefined
      );
      setAudios(results);
    } catch (error) {
      console.error("Erro ao buscar áudios:", error);
      toast.error("Erro ao buscar áudios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedCategory]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      handleSearch();
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const getAudioImageUrl = (audio: Audio): string | null => {
    return (
      audio.thumbnail_url ||
      audio.cover_url ||
      audio.category?.image_url ||
      null
    );
  };

  const toggleAudio = (audioId: string, inRoutine: boolean) => {
    if (inRoutine) {
      removeAudioFromRoutine(audioId);
    } else {
      addAudioToRoutine(audioId);
      toast.success("Adicionado à sua rotina");
    }
  };

  const renderAudios = () => {
    if (loading) {
      return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[...Array(6)].map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/5 p-3 backdrop-blur animate-pulse"
            >
              <div className="h-16 w-16 rounded-xl bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-white/10" />
                <div className="h-3 w-1/2 rounded bg-white/10" />
              </div>
              <div className="h-9 w-9 rounded-full bg-white/10" />
            </div>
          ))}
        </div>
      );
    }

    if (audios.length === 0) {
      return (
        <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/5 px-6 py-10 text-center text-gray-300 backdrop-blur">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
            <Search className="h-5 w-5 text-gray-100" />
          </div>
          <p className="text-sm font-semibold">Nenhum áudio encontrado</p>
          <p className="mt-1 text-xs text-gray-400">
            Ajuste sua busca ou tente outra categoria.
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {audios.map((audio) => {
          const inRoutine = isAudioInRoutine(audio.id);
          const imageUrl = getAudioImageUrl(audio);

          return (
            <button
              key={audio.id}
              onClick={() => toggleAudio(audio.id, inRoutine)}
              className="group flex items-center gap-4 rounded-2xl border border-white/5 bg-white/5 p-3 text-left transition hover:-translate-y-[1px] hover:border-white/15 hover:bg-white/10 backdrop-blur"
            >
              <div className="relative h-16 w-16 overflow-hidden rounded-xl bg-gradient-to-br from-sky-500/40 via-indigo-500/40 to-purple-500/40">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={audio.title}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Play className="h-5 w-5 text-white/80" />
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-white/10" />
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-semibold text-white">
                  {audio.title}
                </p>
                <p className="truncate text-xs text-gray-300">
                  {audio.subtitle || audio.description}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-gray-400">
                  {audio.category && (
                    <Badge
                      variant="secondary"
                      className="rounded-full bg-white/10 text-[11px] text-white"
                    >
                      {audio.category.name}
                    </Badge>
                  )}
                  <span>{formatDuration(audio.duration)}</span>
                </div>
              </div>

              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
                  inRoutine
                    ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-100"
                    : "border-white/10 bg-white/5 text-white"
                }`}
              >
                {inRoutine ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-6xl max-h-[90vh] overflow-auto border border-white/10 bg-[#070a0f]/90 p-0 text-white shadow-2xl backdrop-blur-2xl sm:my-8">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0b1020] via-[#0d111b] to-[#090d15]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.2),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(56,189,248,0.12),transparent_30%)]" />
          <div className="relative flex flex-col gap-6 p-6 md:p-8">
            <DialogHeader className="space-y-3">
              <DialogTitle className="flex items-center gap-3 text-xl font-semibold md:text-2xl">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white shadow-inner">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-white/60">
                    Rotina Premium
                  </p>
                  Adicionar à Minha Rotina
                </div>
              </DialogTitle>
              <p className="text-sm text-white/70">
                Busque por orações e adicione com um clique. Tudo no mesmo fluxo
                minimalista.
              </p>
            </DialogHeader>

            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner backdrop-blur">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar orações por tema, emoção ou referência..."
                  className="h-12 rounded-xl border-white/10 bg-white/5 pl-12 text-white placeholder:text-white/50 focus-visible:border-white/30 focus-visible:ring-2 focus-visible:ring-white/40"
                />
                {loading && (
                  <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/60" />
                )}
              </div>

              <div className="flex w-full gap-2 overflow-x-auto pb-1 text-sm scrollbar-hide">
                <Button
                  size="sm"
                  variant={selectedCategory === "" ? "default" : "outline"}
                  onClick={() => setSelectedCategory("")}
                  className={`shrink-0 rounded-full border px-4 py-2 ${
                    selectedCategory === ""
                      ? "border-white/0 bg-white text-gray-900 shadow"
                      : "border-white/10 bg-white/5 text-white hover:border-white/30"
                  }`}
                >
                  Todas
                </Button>
                {categories.map((category) => {
                  const isActive = selectedCategory === category.id;
                  return (
                    <Button
                      key={category.id}
                      size="sm"
                      variant={isActive ? "default" : "outline"}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`shrink-0 rounded-full border px-4 py-2 ${
                        isActive
                          ? "border-white/0 bg-white text-gray-900 shadow"
                          : "border-white/10 bg-white/5 text-white hover:border-white/30"
                      }`}
                    >
                      {category.name}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="min-h-[320px] rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <ScrollArea className="h-[55vh] pr-3">{renderAudios()}</ScrollArea>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-white/70 hover:bg-white/10"
              >
                <X className="mr-2 h-4 w-4" />
                Fechar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
