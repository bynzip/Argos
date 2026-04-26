import { create } from 'zustand';

interface CajaState {
  cajaAbierta: boolean;
  fondoInicial: number;
  totalDia: number;
  setCaja: (cajaAbierta: boolean, fondoInicial?: number, totalDia?: number) => void;
  clearCaja: () => void;
}

export const useCajaStore = create<CajaState>((set) => ({
  cajaAbierta: false,
  fondoInicial: 0,
  totalDia: 0,
  setCaja: (cajaAbierta, fondoInicial = 0, totalDia = 0) => set({ cajaAbierta, fondoInicial, totalDia }),
  clearCaja: () => set({ cajaAbierta: false, fondoInicial: 0, totalDia: 0 }),
}));
