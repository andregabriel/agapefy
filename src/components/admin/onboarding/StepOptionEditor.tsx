"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, X, Trash } from 'lucide-react';

interface Category {
  id: string;
  name: string;
}

interface Playlist {
  id: string;
  title: string;
  category_id: string | null;
  category_ids?: string[] | null;
}

interface StepOptionEditorProps {
  option: { label: string; category_id: string; playlist_id?: string };
  categories: Category[];
  playlists: Playlist[];
  // When false, the playlist picker is hidden and options should save without playlist_id
  showPlaylistPicker?: boolean;
  onSave: (option: { label: string; category_id: string; playlist_id?: string }) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export default function StepOptionEditor({
  option,
  categories,
  playlists,
  showPlaylistPicker = true,
  onSave,
  onCancel,
  onDelete,
}: StepOptionEditorProps) {
  const [label, setLabel] = useState(option.label || '');
  const [categoryId, setCategoryId] = useState(option.category_id || '');
  const [playlistId, setPlaylistId] = useState(option.playlist_id || '');

  // Filtrar playlists baseado na categoria selecionada
  const filteredPlaylists = categoryId
    ? playlists.filter((p) => (p.category_ids || [p.category_id]).filter(Boolean).includes(categoryId))
    : playlists;

  const handleSave = () => {
    if (!label.trim()) {
      return;
    }
    if (!categoryId) {
      return;
    }
    const payload: { label: string; category_id: string; playlist_id?: string } = {
      label: label.trim(),
      category_id: categoryId,
    };
    if (showPlaylistPicker && playlistId) {
      payload.playlist_id = playlistId;
    }
    onSave(payload);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="option-label">Texto da Opção</Label>
        <Input
          id="option-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex.: Superar Dificuldades financeiras"
        />
      </div>
      <div>
        <Label htmlFor="option-category">Categoria</Label>
        <select
          id="option-category"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPlaylistId(''); // Reset playlist quando categoria muda
          }}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Selecione uma categoria</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>
      {showPlaylistPicker && (
        <div>
          <Label htmlFor="option-playlist">Playlist (opcional)</Label>
          <Input
            id="option-playlist"
            list="playlists-list"
            placeholder="Busque pelo nome da playlist"
            value={filteredPlaylists.find(p => p.id === playlistId)?.title || ''}
            onChange={(e) => {
              const match = filteredPlaylists.find(
                p => (p.title || '').toLowerCase() === e.target.value.toLowerCase()
              );
              setPlaylistId(match?.id || '');
            }}
          />
          <datalist id="playlists-list">
            {filteredPlaylists.map(p => (
              <option key={p.id} value={p.title || ''} />
            ))}
          </datalist>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!label.trim() || !categoryId}
        >
          <Save className="h-4 w-4 mr-2" />
          Salvar
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
        {onDelete && (
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash className="h-4 w-4 mr-2" />
            Deletar
          </Button>
        )}
      </div>
    </div>
  );
}
