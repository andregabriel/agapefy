"use client";

import { Button } from '@/components/ui/button';
import { Plus, ChevronRight as ChevronRightIcon, Edit, Trash2 } from 'lucide-react';

interface IntentionsSectionProps {
  intentions: any[];
  intentionsLoading: boolean;
  handleCreateIntention: () => void;
  handleEditIntention: (intention: any) => void;
  handleDeleteIntention: (intention: any) => void;
  formatIntentionDate: (dateString: string) => string;
}

export function IntentionsSection({
  intentions,
  intentionsLoading,
  handleCreateIntention,
  handleEditIntention,
  handleDeleteIntention,
  formatIntentionDate
}: IntentionsSectionProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white flex items-center">
          Intenções
          <ChevronRightIcon className="h-6 w-6 ml-2 text-gray-400" />
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCreateIntention}
          className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-full w-8 h-8"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="space-y-4">
        {intentionsLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse p-3 rounded-lg">
                <div className="h-4 bg-gray-700 rounded mb-2"></div>
                <div className="h-3 bg-gray-700 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        ) : intentions.length > 0 ? (
          intentions.map((intention) => (
            <div 
              key={intention.id}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-white mb-1">{intention.title}</h3>
                  {intention.description && (
                    <p className="text-sm text-gray-400 mb-2 line-clamp-2">
                      {intention.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    {formatIntentionDate(intention.created_at)}
                  </p>
                </div>
                <div className="flex space-x-1 ml-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditIntention(intention)}
                    className="text-gray-400 hover:text-white hover:bg-gray-700 w-8 h-8"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteIntention(intention)}
                    className="text-gray-400 hover:text-red-400 hover:bg-gray-700 w-8 h-8"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-400">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h3 className="font-medium mb-2">Nenhuma intenção ainda</h3>
              <p className="text-sm mb-4">Crie suas primeiras intenções de oração</p>
              <Button
                onClick={handleCreateIntention}
                variant="outline"
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar primeira intenção
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}