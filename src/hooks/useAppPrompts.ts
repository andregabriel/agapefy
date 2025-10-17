import { useEffect, useState } from 'react';
import { useAppSettings } from '@/hooks/useAppSettings';

export function useAppPrompts() {
  const { settings, updateSetting } = useAppSettings();
  const [localPrompts, setLocalPrompts] = useState({
    title: '',
    subtitle: '',
    description: '',
    preparation: '',
    text: '',
    final_message: '',
    image_prompt: ''
  });

  useEffect(() => {
    setLocalPrompts({
      title: (settings as any)?.gmanual_title_prompt || '',
      subtitle: (settings as any)?.gmanual_subtitle_prompt || '',
      description: (settings as any)?.gmanual_description_prompt || '',
      preparation: (settings as any)?.gmanual_preparation_prompt || '',
      text: (settings as any)?.gmanual_text_prompt || '',
      final_message: (settings as any)?.gmanual_final_message_prompt || '',
      image_prompt: (settings as any)?.gmanual_image_prompt_prompt || ''
    });
  }, [settings]);

  return { localPrompts, setLocalPrompts, updateSetting };
}


