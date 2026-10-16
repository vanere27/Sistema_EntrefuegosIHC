const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { randomUUID } = require('crypto');
require('dotenv').config();

// -- 1. LIBRERÍAS DE CONEXIÓN PARA PRISMA 7 --
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// Configuración de WebSockets para tiempo real
const io = new Server(server, {
  cors: { origin: "*" } 
});

// -- 2. CONEXIÓN OBLIGATORIA A LA BASE DE DATOS --
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const authSessions = new Map();

async function closeAuthSession(token) {
  const session = authSessions.get(token);
  if (!session) return false;
  authSessions.delete(token);
  if (session.sessionLogId) {
    await prisma.sessionLog.updateMany({
      where: { id: session.sessionLogId, logoutAt: null },
      data: { logoutAt: new Date() }
    });
  }
  return true;
}

function requireRoles(...allowedRoles) {
  return async (req, res, next) => {
    const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
    const session = authSessions.get(token);
    if (!session) return res.status(401).json({ error: 'Sesión vencida. Inicia sesión nuevamente.' });

    try {
      const user = await prisma.user.findUnique({ where: { id: session.userId } });
      if (!user || !allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'No tienes permisos para esta acción.' });
      }
      req.authUser = user;
      if (user.role === 'ADMIN') req.adminUser = user;
      return next();
    } catch (error) {
      return res.status(500).json({ error: 'No se pudo validar la sesión.' });
    }
  };
}

const requireAdmin = requireRoles('ADMIN');
const requireCashierOrAdmin = requireRoles('ADMIN', 'CAJERO');
const requireSignedIn = requireRoles('ADMIN', 'CAJERO', 'COCINA', 'MESERO');

// --- RUTAS DE LA API ---

// 1. RUTA DE PRUEBA
app.get('/', (req, res) => {
  res.send('🔥 Servidor de Entre Fuegos activo y conectado a la Base de Datos 🔥');
});

// 2. RUTA DE LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { pin } = req.body;
    const usuario = await prisma.user.findUnique({
      where: { pin: String(pin) }
    });
    if (!usuario) return res.status(401).json({ error: 'PIN incorrecto' });
    const sessionToken = randomUUID();
    const sessionLog = await prisma.sessionLog.create({ data: { userId: usuario.id } });
    authSessions.set(sessionToken, {
      userId: usuario.id,
      name: usuario.name,
      role: usuario.role,
      startedAt: sessionLog.loginAt.toISOString(),
      sessionLogId: sessionLog.id
    });
    io.emit('admin:sessions-updated');
    res.json({ mensaje: `¡Bienvenido, ${usuario.name}!`, usuario: { ...usuario, sessionToken, startedAt: sessionLog.loginAt.toISOString() } });
  } catch (error) {
    res.status(500).json({ error: 'Error en login' });
  }
});

app.delete('/api/session', (req, res) => {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  void (async () => {
    if (token && await closeAuthSession(token)) io.emit('admin:sessions-updated');
    res.sendStatus(204);
  })();
});

app.get('/api/dashboard/summary', requireCashierOrAdmin, async (req, res) => {
  const from = new Date(String(req.query.from ?? ''));
  const to = new Date(String(req.query.to ?? ''));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    return res.status(400).json({ error: 'El rango de fechas no es válido.' });
  }

  try {
    const payments = await prisma.payment.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: { order: { include: { table: true, user: true } } },
      orderBy: { createdAt: 'desc' }
    });
    const legacyOrders = await prisma.order.findMany({
      where: { status: 'COMPLETADA', createdAt: { gte: from, lte: to }, payments: { none: {} } },
      include: { table: true, user: true, items: { include: { product: true } } }
    });

    const byTable = new Map();
    const byWaiter = new Map();
    let total = 0;
    let serviceTotal = 0;
    let orderCount = 0;
    const addSale = (sale) => {
      const tableKey = sale.table.id;
      const waiterKey = sale.user.id;
      const table = byTable.get(tableKey) || { tableId: tableKey, table: sale.table.number, total: 0, serviceTotal: 0, payments: 0 };
      const waiter = byWaiter.get(waiterKey) || { userId: waiterKey, name: sale.user.name, role: sale.user.role, total: 0, serviceTotal: 0, payments: 0 };
      table.total += sale.total;
      table.serviceTotal += sale.serviceAmount;
      table.payments += 1;
      waiter.total += sale.total;
      waiter.serviceTotal += sale.serviceAmount;
      waiter.payments += 1;
      byTable.set(tableKey, table);
      byWaiter.set(waiterKey, waiter);
      total += sale.total;
      serviceTotal += sale.serviceAmount;
    };

    for (const payment of payments) {
      addSale({ table: payment.order.table, user: payment.order.user, total: payment.total, serviceAmount: payment.serviceAmount });
    }
    for (const order of legacyOrders) {
      const legacyTotal = order.items.reduce((sum, item) => sum + item.quantity * item.product.price, 0);
      addSale({ table: order.table, user: order.user, total: legacyTotal, serviceAmount: 0 });
    }
    orderCount = new Set([...payments.map(payment => payment.orderId), ...legacyOrders.map(order => order.id)]).size;

    const sessionWhere = {
      loginAt: { lte: to },
      OR: [{ logoutAt: null }, { logoutAt: { gte: from } }],
      ...(req.authUser.role === 'ADMIN' ? { user: { role: { not: 'ADMIN' } } } : { userId: req.authUser.id })
    };
    const sessions = await prisma.sessionLog.findMany({
      where: sessionWhere,
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { loginAt: 'desc' }
    });
    const now = new Date();
    res.json({
      from: from.toISOString(),
      to: to.toISOString(),
      total,
      serviceTotal,
      paymentCount: payments.length + legacyOrders.length,
      orderCount,
      byTable: [...byTable.values()].sort((a, b) => b.total - a.total),
      byWaiter: [...byWaiter.values()].sort((a, b) => b.total - a.total),
      sessions: sessions.map(session => {
        const effectiveLogin = session.loginAt < from ? from : session.loginAt;
        const effectiveLogout = session.logoutAt && session.logoutAt < to ? session.logoutAt : (session.logoutAt ?? now);
        const durationMinutes = Math.max(0, Math.round((effectiveLogout.getTime() - effectiveLogin.getTime()) / 60000));
        return {
          id: session.id,
          userId: session.user.id,
          name: session.user.name,
          role: session.user.role,
          loginAt: session.loginAt,
          logoutAt: session.logoutAt,
          durationMinutes,
          active: session.logoutAt === null
        };
      })
    });
  } catch (error) {
    console.error('GET /api/dashboard/summary failed:', error);
    res.status(500).json({ error: 'No se pudo cargar el dashboard.' });
  }
});

app.get('/api/user/drafts', requireSignedIn, async (req, res) => {
  try {
    const snapshots = await prisma.userDraftSnapshot.findMany({
      where: { userId: req.authUser.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, items: true, createdAt: true }
    });
    res.json(snapshots);
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron recuperar los borradores.' });
  }
});

app.post('/api/user/drafts', requireSignedIn, async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length > 100) {
    return res.status(400).json({ error: 'El borrador debe contener como máximo 100 productos.' });
  }

  const normalizedItems = [];
  for (const item of items) {
    const productId = Number(item.productId);
    const quantity = Number(item.quantity);
    const price = Number(item.price);
    if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(price) || price < 0 || typeof item.name !== 'string') {
      return res.status(400).json({ error: 'El borrador contiene un producto o cantidad inválida.' });
    }
    normalizedItems.push({
      productId,
      name: item.name.slice(0, 160),
      price,
      quantity,
      notes: typeof item.notes === 'string' ? item.notes.slice(0, 500) : ''
    });
  }

  try {
    const latest = await prisma.userDraftSnapshot.findFirst({
      where: { userId: req.authUser.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, items: true, createdAt: true }
    });
    if (latest && JSON.stringify(latest.items) === JSON.stringify(normalizedItems)) {
      return res.json({ ...latest, unchanged: true });
    }

    const snapshot = await prisma.userDraftSnapshot.create({
      data: { userId: req.authUser.id, items: normalizedItems },
      select: { id: true, items: true, createdAt: true }
    });
    const oldSnapshots = await prisma.userDraftSnapshot.findMany({
      where: { userId: req.authUser.id },
      orderBy: { createdAt: 'desc' },
      skip: 20,
      select: { id: true }
    });
    if (oldSnapshots.length > 0) {
      await prisma.userDraftSnapshot.deleteMany({ where: { id: { in: oldSnapshots.map(snapshot => snapshot.id) } } });
    }
    res.status(201).json(snapshot);
  } catch (error) {
    console.error('POST /api/user/drafts failed:', error);
    res.status(500).json({ error: 'No se pudo guardar el borrador.' });
  }
});

app.delete('/api/user/drafts', requireSignedIn, async (req, res) => {
  try {
    const result = await prisma.userDraftSnapshot.deleteMany({ where: { userId: req.authUser.id } });
    res.json({ deletedSnapshots: result.count });
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron borrar los borradores guardados.' });
  }
});

app.get('/api/admin/sessions', requireAdmin, (req, res) => {
  const sessionsByUser = new Map();
  for (const session of authSessions.values()) {
    const current = sessionsByUser.get(session.userId) || {
      id: session.userId,
      name: session.name,
      role: session.role,
      sessionCount: 0,
      startedAt: session.startedAt,
      connected: false
    };
    current.sessionCount += 1;
    current.startedAt = current.startedAt < session.startedAt ? current.startedAt : session.startedAt;
    sessionsByUser.set(session.userId, current);
  }

  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.userId && sessionsByUser.has(socket.data.userId)) {
      sessionsByUser.get(socket.data.userId).connected = true;
    }
  }

  res.json([...sessionsByUser.values()].filter(session => session.role !== 'ADMIN'));
});

app.delete('/api/admin/sessions/:userId', requireAdmin, async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId === req.adminUser.id) {
    return res.status(400).json({ error: 'No se puede cerrar esta sesión.' });
  }

  let revoked = false;
  for (const [token, session] of authSessions.entries()) {
    if (session.userId === userId && session.role !== 'ADMIN') {
      if (await closeAuthSession(token)) revoked = true;
    }
  }
  if (revoked) io.to(`user:${userId}`).emit('session:revoked');
  io.emit('admin:sessions-updated');
  res.json({ revoked });
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, role: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }]
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron cargar los usuarios.' });
  }
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const pin = String(req.body.pin ?? '');
  const role = String(req.body.role ?? '');
  if (!name || !/^\d{4}$/.test(pin) || !['CAJERO', 'COCINA', 'MESERO'].includes(role)) {
    return res.status(400).json({ error: 'Ingresa un nombre, un PIN de cuatro dígitos y un perfil operativo válido.' });
  }

  try {
    const newUser = await prisma.user.create({
      data: { name, pin, role },
      select: { id: true, name: true, role: true }
    });
    io.emit('admin:users-updated');
    res.status(201).json(newUser);
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Ese PIN ya está asignado a otro empleado.' });
    console.error('POST /api/admin/users failed:', error);
    res.status(500).json({ error: 'No se pudo crear el usuario.' });
  }
});

// 3. RUTA DE MESAS
app.get('/api/tables', async (req, res) => {
  try {
    const mesas = await prisma.table.findMany({
      orderBy: { number: 'asc' },
      include: {
        orders: {
          where: { status: { in: ['PENDIENTE', 'PREPARANDO'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, user: { select: { id: true, name: true } } }
        }
      }
    });
    res.json(mesas.map(({ orders, ...table }) => ({ ...table, activeOrder: orders[0] ?? null })));
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar mesas' });
  }
});

app.post('/api/admin/tables/:tableId/release', requireAdmin, async (req, res) => {
  const tableId = Number(req.params.tableId);
  if (!Number.isInteger(tableId)) return res.status(400).json({ error: 'Mesa inválida.' });

  try {
    const result = await prisma.$transaction(async tx => {
      const table = await tx.table.findUnique({ where: { id: tableId } });
      if (!table) return null;

      const activeOrders = await tx.order.findMany({
        where: { tableId, status: { in: ['PENDIENTE', 'PREPARANDO'] } },
        select: { id: true }
      });
      const orderIds = activeOrders.map(order => order.id);

      if (orderIds.length > 0) {
        await tx.order.updateMany({ where: { id: { in: orderIds } }, data: { status: 'CANCELADA' } });
      }
      const releasedTable = await tx.table.update({ where: { id: tableId }, data: { status: 'libre' } });
      return { table: releasedTable, orderIds };
    });

    if (!result) return res.status(404).json({ error: 'No se encontró la mesa.' });
    io.emit('orden_cancelada_admin', { tableId, orderIds: result.orderIds });
    io.emit('estado_mesa_actualizado', { id: tableId, status: 'libre' });
    io.emit('orden_finalizada_admin', { tableId, cancelled: true });
    res.json({ mensaje: 'Mesa liberada.', tableId, cancelledOrderIds: result.orderIds });
  } catch (error) {
    console.error('POST /api/admin/tables/:tableId/release failed:', error);
    res.status(500).json({ error: 'No se pudo liberar la mesa.' });
  }
});

// 4. RUTA DE PRODUCTOS
app.get('/api/products', async (req, res) => {
  try {
    const productos = await prisma.product.findMany();
    res.json(productos);
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar menú' });
  }
});

// 5. CREAR ORDEN (Meseros)
app.post('/api/orders', async (req, res) => {
  try {
    const { tableId, userId, items } = req.body;
    if (!Number.isInteger(Number(tableId)) || !Number.isInteger(Number(userId))) {
      return res.status(400).json({ error: 'Sesión de mesero inválida. Inicia sesión nuevamente.' });
    }
    const nuevaOrden = await prisma.order.create({
      data: {
        tableId: Number(tableId),
        userId: Number(userId),
        status: "PENDIENTE", 
        items: {
          create: items.map(item => ({
            productId: Number(item.productId),
            quantity: Number(item.quantity),
            notes: item.notes || ""
          }))
        }
      },
      include: { table: true, user: true, items: { include: { product: true } } }
    });

    await prisma.table.update({ where: { id: Number(tableId) }, data: { status: "ocupada" } });

    io.emit('nueva_orden_creada', nuevaOrden);
    io.emit('estado_mesa_actualizado', { id: Number(tableId), status: 'ocupada' });

    res.json({ mensaje: "Comanda enviada", orden: nuevaOrden });
  } catch (error) {
    console.error('POST /api/orders failed:', error);
    res.status(500).json({ error: 'Error al procesar comanda' });
  }
});

// --- RUTAS DE ADMINISTRACIÓN Y GESTIÓN ---

// 6. COMANDAS ACTIVAS
app.get('/api/orders/active', requireCashierOrAdmin, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { status: { in: ['PENDIENTE', 'PREPARANDO'] } },
      include: { table: true, user: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders.map(order => ({
      ...order,
      items: order.items
        .filter(item => item.quantity > item.paidQuantity)
        .map(item => ({ ...item, quantity: item.quantity - item.paidQuantity }))
    })));
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar activas' });
  }
});

// 7. ACTUALIZAR ESTADO (Pendiente -> Listo)
app.patch('/api/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const actualizada = await prisma.order.update({
      where: { id: Number(id) },
      data: { status },
      include: { table: true }
    });
    io.emit('orden_actualizada', actualizada);
    res.json(actualizada);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

// 8. OBTENER ORDEN POR MESA (Para edición)
app.get('/api/orders/table/:tableId', async (req, res) => {
  try {
    const order = await prisma.order.findFirst({
      where: { tableId: Number(req.params.tableId), status: 'PENDIENTE' },
      include: { items: { include: { product: true } }, user: true }
    });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Error al recuperar orden' });
  }
});

// 9. AÑADIR ITEMS A ORDEN EXISTENTE
app.patch('/api/orders/:id/add-items', async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;
    const existingOrder = await prisma.order.findUnique({ where: { id: Number(id) }, select: { status: true } });
    if (!existingOrder) return res.status(404).json({ error: 'No se encontró la comanda.' });
    if (!['PENDIENTE', 'PREPARANDO'].includes(existingOrder.status)) {
      return res.status(409).json({ error: 'Esta comanda ya no está activa y no admite más productos.' });
    }
    await prisma.orderItem.createMany({
      data: items.map(item => ({
        orderId: Number(id),
        productId: Number(item.productId),
        quantity: Number(item.quantity),
        notes: item.notes || ""
      }))
    });
    const ordenCompleta = await prisma.order.findUnique({
      where: { id: Number(id) },
      include: { table: true, user: true, items: { include: { product: true } } }
    });
    io.emit('orden_actualizada_items', ordenCompleta);
    io.emit('nuevos_items_en_comanda', ordenCompleta);
    res.json(ordenCompleta);
  } catch (error) {
    console.error('PATCH /api/orders/:id/add-items failed:', error);
    res.status(500).json({ error: 'Error al añadir productos' });
  }
});

// 10. ELIMINAR ITEM Y LIBERAR MESA SI QUEDA VACÍA
app.delete('/api/order-items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const itemABorrar = await prisma.orderItem.findUnique({ where: { id: Number(id) } });
    if (!itemABorrar) return res.status(404).json({ error: "No encontrado" });
    if (itemABorrar.paidQuantity > 0) return res.status(409).json({ error: "No se puede eliminar un producto que ya fue pagado." });

    const orderId = itemABorrar.orderId;

    await prisma.orderItem.delete({ where: { id: Number(id) } });

    const itemsRestantes = await prisma.orderItem.count({
      where: { orderId: orderId }
    });

    if (itemsRestantes === 0) {
      const ordenEliminada = await prisma.order.delete({
        where: { id: orderId }
      });

      await prisma.table.update({ 
        where: { id: ordenEliminada.tableId }, 
        data: { status: 'libre' } 
      });

      // 🔥 ESTO ES LO QUE LE AVISA AL MONITOR:
      io.emit('orden_eliminada_por_vacia', { id: orderId, tableId: ordenEliminada.tableId });
      io.emit('estado_mesa_actualizado', { id: ordenEliminada.tableId, status: 'libre' });

      return res.json({ mensaje: "Mesa liberada", mesaLiberada: true });
    } else {
      const actualizada = await prisma.order.findUnique({
        where: { id: orderId },
        include: { table: true, user: true, items: { include: { product: true } } }
      });
      io.emit('orden_actualizada_items', actualizada);
      return res.json({ mensaje: "Producto eliminado", mesaLiberada: false });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error al borrar item' });
  }
});

// 11. ACTUALIZAR NOTA
app.patch('/api/order-items/:id/notes', async (req, res) => {
  try {
    const item = await prisma.orderItem.update({
      where: { id: Number(req.params.id) },
      data: { notes: req.body.notes }
    });
    const actualizada = await prisma.order.findUnique({
      where: { id: item.orderId },
      include: { table: true, user: true, items: { include: { product: true } } }
    });
    io.emit('orden_actualizada_items', actualizada);
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Error al editar nota' });
  }
});

// 12. COMPLETAR ORDEN Y LIBERAR MESA
app.patch('/api/orders/:id/complete', requireCashierOrAdmin, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { select: { quantity: true, paidQuantity: true } } }
    });
    if (!order) return res.status(404).json({ error: 'No se encontró la cuenta.' });
    if (order.items.some(item => item.paidQuantity < item.quantity)) {
      return res.status(409).json({ error: 'Aún hay productos pendientes de pago.' });
    }
    res.status(409).json({ error: 'La cuenta se finaliza automáticamente al completar el último pago.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al cerrar cuenta' });
  }
});

app.post('/api/orders/:id/payments', requireCashierOrAdmin, async (req, res) => {
  const orderId = Number(req.params.id);
  const rawItemIds = req.body.itemIds;
  if (!Number.isInteger(orderId) || !Array.isArray(rawItemIds) || rawItemIds.length === 0) {
    return res.status(400).json({ error: 'Selecciona al menos un producto para pagar.' });
  }
  const itemIds = rawItemIds.map(Number);
  if (itemIds.some(id => !Number.isInteger(id)) || new Set(itemIds).size !== itemIds.length) {
    return res.status(400).json({ error: 'La selección de productos no es válida.' });
  }

  try {
    const result = await prisma.$transaction(async tx => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { table: true, user: true, items: { include: { product: true } } }
      });
      if (!order) return { error: 'No se encontró la cuenta.', status: 404 };
      if (!['PENDIENTE', 'PREPARANDO'].includes(order.status)) {
        return { error: 'Esta cuenta ya no está activa.', status: 409 };
      }

      const selectedItems = order.items.filter(item => itemIds.includes(item.id));
      if (selectedItems.length !== itemIds.length || selectedItems.some(item => item.paidQuantity >= item.quantity)) {
        return { error: 'Algún producto seleccionado ya fue pagado o no pertenece a esta cuenta.', status: 409 };
      }

      const paymentItems = selectedItems.map(item => ({
        orderItemId: item.id,
        quantity: item.quantity - item.paidQuantity,
        notes: item.notes,
        product: { id: item.product.id, name: item.product.name, price: item.product.price }
      }));
      const subtotal = paymentItems.reduce((sum, item) => sum + item.quantity * item.product.price, 0);
      const serviceAmount = req.body.includeService === true ? Math.round(subtotal * 0.1) : 0;

      for (const item of selectedItems) {
        const updated = await tx.orderItem.updateMany({
          where: { id: item.id, orderId, paidQuantity: item.paidQuantity },
          data: { paidQuantity: item.quantity }
        });
        if (updated.count !== 1) throw new Error('PAYMENT_CONFLICT');
      }

      const payment = await tx.payment.create({
        data: { orderId, subtotal, serviceAmount, total: subtotal + serviceAmount, items: paymentItems }
      });
      const updatedItems = await tx.orderItem.findMany({ where: { orderId } });
      const completed = updatedItems.every(item => item.paidQuantity >= item.quantity);
      if (completed) {
        await tx.order.update({ where: { id: orderId }, data: { status: 'COMPLETADA' } });
        await tx.table.update({ where: { id: order.tableId }, data: { status: 'libre' } });
      }

      const updatedOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: { table: true, user: true, items: { include: { product: true } }, payments: true }
      });
      return { payment, order: updatedOrder, completed };
    });

    if (result.error) return res.status(result.status).json({ error: result.error });
    const activeOrder = {
      ...result.order,
      items: result.order.items
        .filter(item => item.quantity > item.paidQuantity)
        .map(item => ({ ...item, quantity: item.quantity - item.paidQuantity }))
    };
    io.emit('orden_actualizada_items', activeOrder);
    if (result.completed) {
      io.emit('estado_mesa_actualizado', { id: result.order.tableId, status: 'libre' });
      io.emit('orden_finalizada_admin', { id: orderId });
    }
    res.json({ payment: result.payment, order: result.order, completed: result.completed });
  } catch (error) {
    if (error.message === 'PAYMENT_CONFLICT') return res.status(409).json({ error: 'Otro cobro actualizó esta cuenta. Recarga e intenta de nuevo.' });
    console.error('POST /api/orders/:id/payments failed:', error);
    res.status(500).json({ error: 'No se pudo registrar el pago.' });
  }
});

// --- RUTAS DE HISTORIAL Y ARCHIVO (Business Intelligence) ---

// 13. VENTAS DE HOY (Desde las 00:00)
app.get('/api/orders/history', requireCashierOrAdmin, async (req, res) => {
  try {
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);
    const history = await prisma.order.findMany({
      where: { status: 'COMPLETADA', createdAt: { gte: inicioDia } },
      include: { table: true, user: true, items: { include: { product: true } }, payments: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Error en historial de hoy' });
  }
});

// 14. LISTA DE DÍAS CON VENTAS (Para el Archivo)
app.get('/api/orders/archive-dates', requireAdmin, async (req, res) => {
  try {
    // Obtenemos fechas únicas de órdenes completadas
    const orders = await prisma.order.findMany({
      where: { status: 'COMPLETADA' },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    // Formateamos para tener solo la fecha (YYYY-MM-DD) y quitar duplicados
    const fechasUnicas = [...new Set(orders.map(o => o.createdAt.toISOString().split('T')[0]))];
    const resultado = fechasUnicas.map(f => ({ date: f }));
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener fechas del archivo' });
  }
});

// 15. VENTAS POR FECHA ESPECÍFICA (Archivo Histórico)
app.get('/api/orders/history-by-date', requireAdmin, async (req, res) => {
  const { date } = req.query; // Espera 'YYYY-MM-DD'
  try {
    const inicio = new Date(date + "T00:00:00");
    const fin = new Date(date + "T23:59:59");
    const history = await prisma.order.findMany({
      where: { status: 'COMPLETADA', createdAt: { gte: inicio, lte: fin } },
      include: { table: true, user: true, items: { include: { product: true } }, payments: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Error al recuperar fecha' });
  }
});



// --- RUTAS DE LISTA DE ESPERA (NUEVO) ---

// 16. Obtener la lista de espera activa
app.get('/api/waitlist', requireCashierOrAdmin, async (req, res) => {
  try {
    const list = await prisma.waitlist.findMany({
      where: { status: 'WAITING' },
      orderBy: { createdAt: 'asc' } // Orden cronológico (el que llegó primero va primero)
    });
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar lista de espera' });
  }
});

// 17. Añadir un cliente a la lista de espera
app.post('/api/waitlist', requireCashierOrAdmin, async (req, res) => {
  try {
    const { name, partySize, phone } = req.body;
    const entry = await prisma.waitlist.create({
      data: {
        name,
        partySize: Number(partySize),
        phone: phone || "",
        status: 'WAITING'
      }
    });
    // Avisamos a todos los dispositivos por Sockets
    io.emit('waitlist_updated', entry); 
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: 'Error al añadir a lista' });
  }
});

// 18. Asignar mesa (Quitar de la lista de espera)
app.patch('/api/waitlist/:id/seat', requireCashierOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await prisma.waitlist.update({
      where: { id: Number(id) },
      data: { status: 'SEATED' }
    });
    io.emit('waitlist_updated', updated);
    res.json({ mensaje: "Cliente asignado a mesa", updated });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar lista' });
  }
});

// --- RUTAS IHC: PANTALLA DE COCINA (KDS) ---

// 19. Obtener comandas activas solo con ítems para preparar
app.get('/api/kitchen/orders', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { status: { in: ['PENDIENTE', 'PREPARANDO'] } },
      include: {
        table: true,
        user: true,
        items: {
          where: { cookStatus: { not: 'LISTO' } }, // La cocina no necesita ver lo que ya salió
          include: { product: true },
          orderBy: { id: 'asc' }
        }
      },
      orderBy: { createdAt: 'asc' } // Prioridad: El pedido más viejo va primero
    });
    // Filtramos para enviar solo órdenes que tengan platos pendientes
    const activeKitchenOrders = orders.filter(o => o.items.length > 0);
    res.json(activeKitchenOrders);
  } catch (error) { res.status(500).json({ error: 'Error en cocina' }); }
});

// 20. Actualizar el estado de preparación de un plato específico
app.patch('/api/order-items/:id/cook-status', async (req, res) => {
  try {
    const { id } = req.params;
    const { cookStatus } = req.body;
    
    const updatedItem = await prisma.orderItem.update({
      where: { id: Number(id) },
      data: { cookStatus },
      include: { product: true, order: { include: { table: true } } }
    });
    
    // Avisamos por Sockets para que la tablet del mesero reciba la notificación
    io.emit('item_cook_status_updated', updatedItem);
    res.json(updatedItem);
  } catch (error) { res.status(500).json({ error: 'Error al actualizar plato' }); }
});


// --- TIEMPO REAL ---
io.on('connection', (socket) => {
  const sessionToken = socket.handshake.auth?.sessionToken;
  const session = sessionToken ? authSessions.get(sessionToken) : null;
  if (sessionToken && !session) socket.emit('session:revoked');
  if (session) {
    socket.data.userId = session.userId;
    socket.join(`user:${session.userId}`);
    io.emit('admin:sessions-updated');
  }

  console.log('📱 Dispositivo conectado:', socket.id);
  socket.on('disconnect', () => {
    if (socket.data.userId) io.emit('admin:sessions-updated');
    console.log('❌ Desconectado:', socket.id);
  });
});

// --- ENCENDIDO ---
void prisma.sessionLog.updateMany({ where: { logoutAt: null }, data: { logoutAt: new Date() } })
  .catch(error => console.error('No se pudieron cerrar sesiones anteriores:', error));

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SERVIDOR ENTRE FUEGOS INICIADO EN PUERTO ${PORT}`);
});
