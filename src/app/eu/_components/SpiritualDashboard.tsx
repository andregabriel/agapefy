"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Calendar } from '@/components/ui/calendar';
import { Target, Award, Timer } from 'lucide-react';
import { GoalsSettings } from '@/components/GoalsSettings';

interface SpiritualDashboardProps {
  goals: any;
  goalsLoading: boolean;
  prayerDates: Date[];
  datesLoading: boolean;
  consecutiveDays: number;
  metrics: any;
  metricsLoading: boolean;
  getWeeklyProgressText: (weeklyGoal: number) => string;
  getConsecutiveProgressText: (consecutiveGoal: number) => string;
}

export function SpiritualDashboard({
  goals,
  goalsLoading,
  prayerDates,
  datesLoading,
  consecutiveDays,
  metrics,
  metricsLoading,
  getWeeklyProgressText,
  getConsecutiveProgressText
}: SpiritualDashboardProps) {
  const weeklyGoal = goals?.weekly_goal || 7;
  const consecutiveGoal = goals?.consecutive_goal || 7;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white mb-4">Dashboard Espiritual</h2>
      
      {/* Métricas Semanais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm flex items-center">
              <Target className="h-4 w-4 mr-2 text-blue-500" />
              Orações Esta Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            {goalsLoading || metricsLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-700 rounded"></div>
                <div className="h-2 bg-gray-700 rounded"></div>
                <div className="h-3 bg-gray-700 rounded w-3/4"></div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Progresso</span>
                  <span className="text-white">{metrics.currentWeekPrayers}/{weeklyGoal}</span>
                </div>
                <Progress 
                  value={(metrics.currentWeekPrayers / weeklyGoal) * 100} 
                  className="h-2"
                />
                <p className="text-xs text-gray-400">
                  {getWeeklyProgressText(weeklyGoal)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm flex items-center">
              <Award className="h-4 w-4 mr-2 text-yellow-500" />
              Dias Consecutivos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {goalsLoading || datesLoading || metricsLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-700 rounded"></div>
                <div className="h-2 bg-gray-700 rounded"></div>
                <div className="h-3 bg-gray-700 rounded w-3/4"></div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Sequência</span>
                  <span className="text-white">{consecutiveDays}/{consecutiveGoal}</span>
                </div>
                <Progress 
                  value={(consecutiveDays / consecutiveGoal) * 100} 
                  className="h-2"
                />
                <p className="text-xs text-gray-400">
                  {getConsecutiveProgressText(consecutiveGoal)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recordes, Minutos Totais e Configurações */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm flex items-center">
              <Award className="h-4 w-4 mr-2 text-green-500" />
              Recordes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-3 bg-gray-700 rounded"></div>
                <div className="h-3 bg-gray-700 rounded"></div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Orações/semana</span>
                  <span className="text-green-400 font-bold">{metrics.bestWeeklyStreak}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Dias consecutivos</span>
                  <span className="text-green-400 font-bold">{metrics.bestConsecutiveDays}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm flex items-center">
              <Timer className="h-4 w-4 mr-2 text-purple-500" />
              Tempo Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-6 bg-gray-700 rounded"></div>
                <div className="h-3 bg-gray-700 rounded w-3/4"></div>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{metrics.totalHours}h</p>
                <p className="text-sm text-gray-400">{metrics.totalMinutesRemainder}min rezados</p>
                {metrics.totalActivities > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {metrics.totalActivities} sessões • {metrics.completedActivities} completas
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Componente de Configuração de Metas */}
        <GoalsSettings />
      </div>

      {/* Calendário de Orações */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm">Calendário de Orações</CardTitle>
        </CardHeader>
        <CardContent>
          {datesLoading ? (
            <div className="animate-pulse">
              <div className="h-64 bg-gray-700 rounded"></div>
            </div>
          ) : (
            <div className="scale-90 origin-top-left">
              <Calendar
                mode="multiple"
                selected={prayerDates}
                className="rounded-md border-gray-700"
                classNames={{
                  day_selected: "bg-green-600 text-white hover:bg-green-700",
                  day_today: "bg-blue-600 text-white",
                }}
                disabled={true} // Calendário apenas para visualização
              />
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Datas marcadas em verde: dias em que você orou
          </p>
        </CardContent>
      </Card>
    </div>
  );
}