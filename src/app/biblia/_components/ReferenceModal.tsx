// CHANGELOG: Fase 6.1 – Remoção de StackTrace e hardening de erros/SSR guards
"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface ParsedReference {
  book: string;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
}

interface ReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (book: string, chapter: number, verse?: number) => void;
}

// Mapeamento de abreviações PT-BR para códigos de livros
const BOOK_ABBREVIATIONS: Record<string, string> = {
  // Antigo Testamento
  'gn': 'GEN', 'gen': 'GEN', 'gênesis': 'GEN', 'genesis': 'GEN',
  'ex': 'EXO', 'êx': 'EXO', 'êxodo': 'EXO', 'exodo': 'EXO',
  'lv': 'LEV', 'lev': 'LEV', 'levítico': 'LEV', 'levitico': 'LEV',
  'nm': 'NUM', 'num': 'NUM', 'números': 'NUM', 'numeros': 'NUM',
  'dt': 'DEU', 'deu': 'DEU', 'deuteronômio': 'DEU', 'deuteronomio': 'DEU',
  'js': 'JOS', 'jos': 'JOS', 'josué': 'JOS', 'josue': 'JOS',
  'jz': 'JDG', 'jdg': 'JDG', 'juízes': 'JDG', 'juizes': 'JDG',
  'rt': 'RUT', 'rut': 'RUT', 'rute': 'RUT',
  '1sm': '1SA', '1 sm': '1SA', '1samuel': '1SA', '1 samuel': '1SA',
  '2sm': '2SA', '2 sm': '2SA', '2samuel': '2SA', '2 samuel': '2SA',
  '1rs': '1KI', '1 rs': '1KI', '1reis': '1KI', '1 reis': '1KI',
  '2rs': '2KI', '2 rs': '2KI', '2reis': '2KI', '2 reis': '2KI',
  '1cr': '1CH', '1 cr': '1CH', '1crônicas': '1CH', '1 crônicas': '1CH',
  '2cr': '2CH', '2 cr': '2CH', '2crônicas': '2CH', '2 crônicas': '2CH',
  'ed': 'EZR', 'esd': 'EZR', 'esdras': 'EZR',
  'ne': 'NEH', 'nee': 'NEH', 'neemias': 'NEH',
  'tb': 'TOB', 'tob': 'TOB', 'tobias': 'TOB',
  'jt': 'JDT', 'jdt': 'JDT', 'judite': 'JDT',
  'et': 'EST', 'est': 'EST', 'ester': 'EST',
  '1mc': '1MA', '1 mc': '1MA', '1macabeus': '1MA', '1 macabeus': '1MA',
  '2mc': '2MA', '2 mc': '2MA', '2macabeus': '2MA', '2 macabeus': '2MA',
  'jó': 'JOB', 'jo': 'JOB', 'job': 'JOB',
  'sl': 'PSA', 'sal': 'PSA', 'salmos': 'PSA',
  'pv': 'PRO', 'pro': 'PRO', 'provérbios': 'PRO', 'proverbios': 'PRO',
  'ec': 'ECC', 'ecl': 'ECC', 'eclesiastes': 'ECC',
  'ct': 'SNG', 'cnt': 'SNG', 'cânticos': 'SNG', 'canticos': 'SNG',
  'sb': 'WIS', 'sab': 'WIS', 'sabedoria': 'WIS',
  'sr': 'SIR', 'sir': 'SIR', 'eclesiástico': 'SIR', 'eclesiastico': 'SIR',
  'is': 'ISA', 'isa': 'ISA', 'isaías': 'ISA', 'isaias': 'ISA',
  'jr': 'JER', 'jer': 'JER', 'jeremias': 'JER',
  'lm': 'LAM', 'lam': 'LAM', 'lamentações': 'LAM', 'lamentacoes': 'LAM',
  'br': 'BAR', 'bar': 'BAR', 'baruc': 'BAR',
  'ez': 'EZK', 'ezq': 'EZK', 'ezequiel': 'EZK',
  'dn': 'DAN', 'dan': 'DAN', 'daniel': 'DAN',
  'os': 'HOS', 'ose': 'HOS', 'oseias': 'HOS',
  'jl': 'JOL', 'joel': 'JOL',
  'am': 'AMO', 'amo': 'AMO', 'amós': 'AMO', 'amos': 'AMO',
  'ob': 'OBA', 'abd': 'OBA', 'abdias': 'OBA',
  'jn': 'JON', 'jon': 'JON', 'jonas': 'JON',
  'mq': 'MIC', 'mic': 'MIC', 'miqueias': 'MIC',
  'na': 'NAH', 'nah': 'NAH', 'naum': 'NAH',
  'hc': 'HAB', 'hab': 'HAB', 'habacuc': 'HAB',
  'sf': 'ZEP', 'sof': 'ZEP', 'sofonias': 'ZEP',
  'ag': 'HAG', 'ageu': 'HAG',
  'zc': 'ZEC', 'zac': 'ZEC', 'zacarias': 'ZEC',
  'ml': 'MAL', 'mal': 'MAL', 'malaquias': 'MAL',
  
  // Novo Testamento
  'mt': 'MAT', 'mat': 'MAT', 'mateus': 'MAT',
  'mc': 'MRK', 'mar': 'MRK', 'marcos': 'MRK',
  'lc': 'LUK', 'luc': 'LUK', 'lucas': 'LUK',
  'jo': 'JHN', 'joão': 'JHN', 'joao': 'JHN',
  'at': 'ACT', 'atos': 'ACT',
  'rm': 'ROM', 'rom': 'ROM', 'romanos': 'ROM',
  '1co': '1CO', '1 co': '1CO', '1coríntios': '1CO', '1 coríntios': '1CO', '1corintios': '1CO', '1 corintios': '1CO',
  '2co': '2CO', '2 co': '2CO', '2coríntios': '2CO', '2 coríntios': '2CO', '2corintios': '2CO', '2 corintios': '2CO',
  'gl': 'GAL', 'gal': 'GAL', 'gálatas': 'GAL', 'galatas': 'GAL',
  'ef': 'EPH', 'efe': 'EPH', 'efésios': 'EPH', 'efesios': 'EPH',
  'fp': 'PHP', 'fil': 'PHP', 'filipenses': 'PHP',
  'cl': 'COL', 'col': 'COL', 'colossenses': 'COL',
  '1ts': '1TH', '1 ts': '1TH', '1tessalonicenses': '1TH', '1 tessalonicenses': '1TH',
  '2ts': '2TH', '2 ts': '2TH', '2tessalonicenses': '2TH', '2 tessalonicenses': '2TH',
  '1tm': '1TI', '1 tm': '1TI', '1timóteo': '1TI', '1 timóteo': '1TI', '1timoteo': '1TI', '1 timoteo': '1TI',
  '2tm': '2TI', '2 tm': '2TI', '2timóteo': '2TI', '2 timóteo': '2TI', '2timoteo': '2TI', '2 timoteo': '2TI',
  'tt': 'TIT', 'tit': 'TIT', 'tito': 'TIT',
  'fm': 'PHM', 'flm': 'PHM', 'filemom': 'PHM',
  'hb': 'HEB', 'heb': 'HEB', 'hebreus': 'HEB',
  'tg': 'JAS', 'tia': 'JAS', 'tiago': 'JAS',
  '1pe': '1PE', '1 pe': '1PE', '1pedro': '1PE', '1 pedro': '1PE',
  '2pe': '2PE', '2 pe': '2PE', '2pedro': '2PE', '2 pedro': '2PE',
  '1jo': '1JN', '1 jo': '1JN', '1joão': '1JN', '1 joão': '1JN', '1joao': '1JN', '1 joao': '1JN',
  '2jo': '2JN', '2 jo': '2JN', '2joão': '2JN', '2 joão': '2JN', '2joao': '2JN', '2 joao': '2JN',
  '3jo': '3JN', '3 jo': '3JN', '3joão': '3JN', '3 joão': '3JN', '3joao': '3JN', '3 joao': '3JN',
  'jd': 'JUD', 'jud': 'JUD', 'judas': 'JUD',
  'ap': 'REV', 'apo': 'REV', 'apocalipse': 'REV'
};

function parseReference(input: string): ParsedReference | null {
  try {
    if (!input || typeof input !== 'string') return null;
    
    // Normalizar entrada: remover acentos, converter para minúsculas, limpar espaços extras
    const normalized = input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .trim()
      .replace(/\s+/g, ' '); // Múltiplos espaços → um espaço
    
    // Regex para capturar: [livro] [capítulo][:verso[-verso]]
    const regex = /^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/;
    const match = normalized.match(regex);
    
    if (!match) return null;
    
    const [, bookPart, chapterStr, verseStartStr, verseEndStr] = match;
    
    // Buscar livro no mapeamento
    const bookKey = bookPart.replace(/\s+/g, '').toLowerCase();
    const bookCode = BOOK_ABBREVIATIONS[bookKey];
    
    if (!bookCode) return null;
    
    const chapter = parseInt(chapterStr, 10);
    if (isNaN(chapter) || chapter < 1) return null;
    
    let verseStart: number | undefined;
    let verseEnd: number | undefined;
    
    if (verseStartStr) {
      verseStart = parseInt(verseStartStr, 10);
      if (isNaN(verseStart) || verseStart < 1) return null;
      
      if (verseEndStr) {
        verseEnd = parseInt(verseEndStr, 10);
        if (isNaN(verseEnd) || verseEnd < verseStart) return null;
      }
    }
    
    return {
      book: bookCode,
      chapter,
      verseStart,
      verseEnd
    };
  } catch (e) {
    console.error("[biblia:parser]", e);
    return null;
  }
}

export default function ReferenceModal({ isOpen, onClose, onNavigate }: ReferenceModalProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    
    setError('');
    setIsLoading(true);
    
    try {
      const parsed = parseReference(input.trim());
      
      if (!parsed) {
        setError('Referência não reconhecida. Ex.: Jo 3:16, 1 Co 13, Sl 23.');
        return;
      }
      
      // Navegar para a referência
      await onNavigate(parsed.book, parsed.chapter, parsed.verseStart);
      
      // Fechar modal
      onClose();
      setInput('');
      setError('');
    } catch (e) {
      console.error("[biblia:modal]", e);
      setError('Erro ao processar referência.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const handleClose = () => {
    onClose();
    setInput('');
    setError('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md w-full h-full sm:h-auto flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search size={20} />
            Ir para referência
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col gap-4 py-4">
          <div className="space-y-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ex.: Jo 3:16, 1 Co 13, Sl 23"
              className="min-h-[44px]"
              aria-label="Digite a referência bíblica"
              aria-describedby={error ? "error-message" : "help-text"}
              autoFocus
            />
            
            {!error && (
              <p id="help-text" className="text-sm text-gray-500">
                Digite uma referência como: Jo 3:16, João 3:16-18, 1 Co 13, Sl 23
              </p>
            )}
            
            {error && (
              <p id="error-message" className="text-sm text-red-600">
                {error}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex-1 min-h-[44px]"
            aria-label="Cancelar busca de referência"
          >
            Cancelar
          </Button>
          
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className="flex-1 min-h-[44px]"
            aria-label="Ir para referência bíblica"
          >
            {isLoading ? 'Carregando...' : 'Ir'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}