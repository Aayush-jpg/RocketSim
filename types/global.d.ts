declare global {
  interface Window {
    environmentConditions?: {
      latitude: number;
      longitude: number;
      elevation: number;
      windSpeed: number;
      windDirection: number;
      atmosphericModel: string;
      date: string;
      temperature: number;
      pressure: number;
      humidity: number;
      visibility: number;
      cloudCover: number;
      dewPoint?: number;
      locationName?: string;
      weatherSource?: string;
      timestamp?: string;
    };
  }
}

export {}; 