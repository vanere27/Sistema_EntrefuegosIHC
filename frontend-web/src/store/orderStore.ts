// src/store/orderStore.ts
import { create } from 'zustand';

// Definimos la estructura de un ítem en la orden
export interface OrderItemInput {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

interface OrderStore {
  items: OrderItemInput[];
  undoStack: OrderItemInput[][];
  redoStack: OrderItemInput[][];
  addItem: (item: Omit<OrderItemInput, 'quantity'>) => void;
  // removeItem ahora requiere las notas para identificar exactamente qué variante eliminar
  removeItem: (productId: number, notes?: string) => void; 
  removeItems: (items: Pick<OrderItemInput, 'productId' | 'notes'>[]) => void;
  updateNotes: (productId: number, notes: string) => void;
  undo: () => void;
  redo: () => void;
  restoreItems: (items: OrderItemInput[]) => void;
  clearOrder: () => void;
  getTotal: () => number;
}

const commitItems = (state: OrderStore, items: OrderItemInput[]) => ({
  items,
  undoStack: [...state.undoStack.slice(-49), state.items],
  redoStack: [],
});

export const useOrderStore = create<OrderStore>((set, get) => ({
  items: [],
  undoStack: [],
  redoStack: [],
  
  addItem: (newItem) => set((state) => {
    // BUSQUEDA CRÍTICA: Buscamos un producto que coincida en ID Y en la NOTA exacta
    const existing = state.items.find(
      i => i.productId === newItem.productId && i.notes === newItem.notes
    );

    if (existing) {
      // Si existe la combinación exacta, sumamos a la cantidad
      return commitItems(state, state.items.map(i => 
          (i.productId === newItem.productId && i.notes === newItem.notes)
            ? { ...i, quantity: i.quantity + 1 } 
            : i
        ));
    }
    // Si la nota es diferente o el producto es nuevo, se crea una nueva línea en la comanda
    return commitItems(state, [...state.items, { ...newItem, quantity: 1 }]);
  }),

  removeItem: (productId, notes) => set((state) => {
    // Identificamos el producto específico por ID y Nota
    const existing = state.items.find(
      i => i.productId === productId && i.notes === notes
    );

    if (existing && existing.quantity > 1) {
      // Si hay más de uno, restamos uno a la cantidad
      return commitItems(state, state.items.map(i => 
          (i.productId === productId && i.notes === notes)
            ? { ...i, quantity: i.quantity - 1 } 
            : i
        ));
    }
    // Si solo queda uno, eliminamos la línea completa de la comanda
    return commitItems(state, state.items.filter(i => !(i.productId === productId && i.notes === notes)));
  }),

  removeItems: (itemsToRemove) => set((state) => {
    const keysToRemove = new Set(itemsToRemove.map(item => `${item.productId}:${item.notes ?? ''}`));
    return {
      items: state.items.filter(item => !keysToRemove.has(`${item.productId}:${item.notes ?? ''}`)),
      undoStack: [],
      redoStack: [],
    };
  }),

  updateNotes: (productId, notes) => set((state) => commitItems(state, state.items.map(i => 
    // Permite actualizar la nota de un producto existente por su ID
    i.productId === productId ? { ...i, notes } : i
  ))),

  undo: () => set((state) => {
    if (state.undoStack.length === 0) return state;
    const previousItems = state.undoStack[state.undoStack.length - 1];
    return {
      items: previousItems,
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, state.items],
    };
  }),

  redo: () => set((state) => {
    if (state.redoStack.length === 0) return state;
    const nextItems = state.redoStack[state.redoStack.length - 1];
    return {
      items: nextItems,
      undoStack: [...state.undoStack, state.items],
      redoStack: state.redoStack.slice(0, -1),
    };
  }),

  restoreItems: (items) => set({ items, undoStack: [], redoStack: [] }),
  
  clearOrder: () => set({ items: [], undoStack: [], redoStack: [] }),
  
  getTotal: () => get().items.reduce((total, item) => total + (item.price * item.quantity), 0),
}));