// Audio utilities extracted from AIGenerator.tsx

export const getAudioDuration = (audioDataUrl: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    const audio = new Audio();

    audio.onloadedmetadata = () => {
      resolve(audio.duration);
    };

    audio.onerror = (error) => {
      reject(error);
    };

    audio.ontimeupdate = () => {
      audio.ontimeupdate = null;
    };

    audio.src = audioDataUrl;
  });
};


