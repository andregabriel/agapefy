"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Music, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface AudioUploadProps {
  onUploadComplete?: (audioUrl: string) => void;
}

export const AudioUpload = ({ onUploadComplete }: AudioUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { user } = useAuth();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Verificar se é um arquivo de áudio
      if (!file.type.startsWith('audio/')) {
        alert('Por favor, selecione um arquivo de áudio válido');
        return;
      }
      
      // Verificar tamanho (máximo 50MB)
      if (file.size > 50 * 1024 * 1024) {
        alert('Arquivo muito grande. Máximo 50MB permitido');
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const uploadAudio = async () => {
    if (!selectedFile || !user) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // Gerar nome único para o arquivo
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload para o Supabase Storage
      const { data, error } = await supabase.storage
        .from('audios')
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        throw error;
      }

      // Obter URL pública do arquivo
      const { data: { publicUrl } } = supabase.storage
        .from('audios')
        .getPublicUrl(fileName);

      setUploadProgress(100);
      
      if (onUploadComplete) {
        onUploadComplete(publicUrl);
      }

      // Limpar estado
      setSelectedFile(null);
      setUploadProgress(0);
      
    } catch (error) {
      console.error('Erro no upload:', error);
      alert('Erro ao fazer upload do arquivo');
    } finally {
      setUploading(false);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setUploadProgress(0);
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <Music className="mr-2" size={20} />
          Upload de Áudio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!selectedFile ? (
          <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center">
            <Upload className="mx-auto mb-4 text-gray-400" size={48} />
            <p className="text-gray-400 mb-4">
              Arraste um arquivo de áudio aqui ou clique para selecionar
            </p>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileSelect}
              className="hidden"
              id="audio-upload"
            />
            <label htmlFor="audio-upload">
              <Button variant="outline" className="cursor-pointer">
                Selecionar Arquivo
              </Button>
            </label>
            <p className="text-xs text-gray-500 mt-2">
              Formatos suportados: MP3, WAV, M4A (máx. 50MB)
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div className="flex items-center space-x-3">
                <Music className="text-green-500" size={20} />
                <div>
                  <p className="text-white font-medium">{selectedFile.name}</p>
                  <p className="text-gray-400 text-sm">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={removeSelectedFile}
                disabled={uploading}
              >
                <X size={16} />
              </Button>
            </div>

            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Fazendo upload...</span>
                  <span className="text-white">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <Button
              onClick={uploadAudio}
              disabled={uploading}
              className="w-full"
            >
              {uploading ? 'Fazendo Upload...' : 'Fazer Upload'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};