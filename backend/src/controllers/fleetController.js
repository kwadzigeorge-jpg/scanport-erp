const db = require('../config/database');

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function logAudit(req, action, entity, entityId, details) {
  try {
    await db.query(
      `INSERT INTO audit_logs (username, role, action, entity, entity_id, details, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [req.user?.username, req.user?.role, action, entity, entityId, JSON.stringify(details), req.ip]
    );
  } catch (_) {}
}

async function generateAlerts() {
  try {
    // Service due within 500 km or overdue
    await db.query(`
      INSERT INTO fleet_alerts (vehicle_id, alert_type, message)
      SELECT v.id,
        CASE WHEN v.current_odometer_km >= m.next_service_km THEN 'service_overdue' ELSE 'service_due' END,
        CASE WHEN v.current_odometer_km >= m.next_service_km
          THEN 'Service OVERDUE for ' || v.registration_number || '. Due: ' || m.next_service_km::INT || ' km, Current: ' || v.current_odometer_km::INT || ' km'
          ELSE 'Service due within 500 km for ' || v.registration_number || '. Due at: ' || m.next_service_km::INT || ' km'
        END
      FROM fleet_vehicles v
      JOIN LATERAL (
        SELECT next_service_km FROM fleet_maintenance_records
        WHERE vehicle_id = v.id AND next_service_km IS NOT NULL
        ORDER BY service_date DESC LIMIT 1
      ) m ON TRUE
      WHERE v.status = 'active'
        AND (v.current_odometer_km >= m.next_service_km OR m.next_service_km - v.current_odometer_km <= 500)
        AND NOT EXISTS (
          SELECT 1 FROM fleet_alerts
          WHERE vehicle_id = v.id
            AND alert_type IN ('service_due','service_overdue')
            AND is_dismissed = FALSE
            AND created_at > NOW() - INTERVAL '7 days'
        )
    `);

    await db.query(`
      INSERT INTO fleet_alerts (vehicle_id, alert_type, message)
      SELECT id, 'insurance_expiry',
        'Insurance expiring ' || TO_CHAR(insurance_expiry,'DD Mon YYYY') || ' for ' || registration_number
      FROM fleet_vehicles
      WHERE status = 'active'
        AND insurance_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        AND NOT EXISTS (
          SELECT 1 FROM fleet_alerts
          WHERE vehicle_id = fleet_vehicles.id AND alert_type = 'insurance_expiry'
            AND is_dismissed = FALSE AND created_at > NOW() - INTERVAL '7 days'
        )
    `);

    await db.query(`
      INSERT INTO fleet_alerts (vehicle_id, alert_type, message)
      SELECT id, 'roadworthy_expiry',
        'Roadworthy expiring ' || TO_CHAR(roadworthy_expiry,'DD Mon YYYY') || ' for ' || registration_number
      FROM fleet_vehicles
      WHERE status = 'active'
        AND roadworthy_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        AND NOT EXISTS (
          SELECT 1 FROM fleet_alerts
          WHERE vehicle_id = fleet_vehicles.id AND alert_type = 'roadworthy_expiry'
            AND is_dismissed = FALSE AND created_at > NOW() - INTERVAL '7 days'
        )
    `);

    await db.query(`
      INSERT INTO fleet_alerts (driver_id, alert_type, message)
      SELECT id, 'license_expiry',
        'Driver license expiring ' || TO_CHAR(license_expiry,'DD Mon YYYY') || ' for ' || full_name
      FROM fleet_drivers
      WHERE status = 'active'
        AND license_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        AND NOT EXISTS (
          SELECT 1 FROM fleet_alerts
          WHERE driver_id = fleet_drivers.id AND alert_type = 'license_expiry'
            AND is_dismissed = FALSE AND created_at > NOW() - INTERVAL '7 days'
        )
    `);
  } catch (err) {
    console.error('[Fleet] alert generation error:', err.message);
  }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function getDashboard(req, res, next) {
  try {
    await generateAlerts();
    const [fleet, mileage, fuel, maint, alertsRes] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*)                                              AS total,
          COUNT(*) FILTER (WHERE status='active')              AS active,
          COUNT(*) FILTER (WHERE status='under_maintenance')   AS under_maintenance,
          COUNT(*) FILTER (WHERE status='out_of_service')      AS out_of_service
        FROM fleet_vehicles
      `),
      db.query(`
        SELECT
          COALESCE(SUM(distance_km),0)::FLOAT        AS total_km_this_month,
          COUNT(*) FILTER (WHERE status='pending')   AS pending_approvals,
          COUNT(*) FILTER (WHERE trip_date=CURRENT_DATE) AS trips_today
        FROM fleet_mileage_logs
        WHERE trip_date >= DATE_TRUNC('month', NOW())
      `),
      db.query(`
        SELECT COALESCE(SUM(litres),0)::FLOAT        AS litres_this_month,
               COALESCE(SUM(total_cost),0)::FLOAT    AS fuel_cost_this_month
        FROM fleet_fuel_logs WHERE fuel_date >= DATE_TRUNC('month', NOW())
      `),
      db.query(`
        SELECT COALESCE(SUM(cost),0)::FLOAT                                    AS cost_this_month,
               COUNT(*) FILTER (WHERE status IN ('scheduled','in_progress'))   AS open_jobs
        FROM fleet_maintenance_records WHERE service_date >= DATE_TRUNC('month', NOW())
      `),
      db.query(`
        SELECT fa.*, v.registration_number, d.full_name AS driver_name
        FROM fleet_alerts fa
        LEFT JOIN fleet_vehicles v ON v.id = fa.vehicle_id
        LEFT JOIN fleet_drivers  d ON d.id = fa.driver_id
        WHERE fa.is_dismissed = FALSE
        ORDER BY fa.created_at DESC LIMIT 20
      `),
    ]);

    return res.json({
      vehicles:    fleet.rows[0],
      mileage:     mileage.rows[0],
      fuel:        fuel.rows[0],
      maintenance: maint.rows[0],
      alerts:      alertsRes.rows,
    });
  } catch (err) { next(err); }
}

// ─── Vehicles ─────────────────────────────────────────────────────────────────
async function listVehicles(req, res, next) {
  try {
    const { status, search } = req.query;
    const cond = ['1=1']; const p = [];
    if (status) { p.push(status); cond.push(`v.status=$${p.length}`); }
    if (search) { p.push(`%${search}%`); cond.push(`(v.registration_number ILIKE $${p.length} OR v.make ILIKE $${p.length} OR v.model ILIKE $${p.length})`); }

    const { rows } = await db.query(`
      SELECT v.*, t.label AS department_name,
        (SELECT COALESCE(SUM(distance_km),0)::FLOAT FROM fleet_mileage_logs
         WHERE vehicle_id=v.id AND trip_date >= DATE_TRUNC('month',NOW())) AS km_this_month,
        (SELECT json_agg(json_build_object('id',d.id,'full_name',d.full_name,'is_primary',vd.is_primary))
         FROM fleet_vehicle_drivers vd JOIN fleet_drivers d ON d.id=vd.driver_id
         WHERE vd.vehicle_id=v.id AND vd.unassigned_date IS NULL) AS assigned_drivers,
        (SELECT json_build_object('next_service_km',mr.next_service_km,'service_date',mr.service_date)
         FROM fleet_maintenance_records mr
         WHERE mr.vehicle_id=v.id AND mr.next_service_km IS NOT NULL
         ORDER BY mr.service_date DESC LIMIT 1) AS last_service
      FROM fleet_vehicles v
      LEFT JOIN lms_teams t ON t.id=v.department_id
      WHERE ${cond.join(' AND ')}
      ORDER BY v.registration_number
    `, p);
    return res.json(rows);
  } catch (err) { next(err); }
}

async function getVehicle(req, res, next) {
  try {
    const { rows } = await db.query(`
      SELECT v.*, t.label AS department_name
      FROM fleet_vehicles v LEFT JOIN lms_teams t ON t.id=v.department_id
      WHERE v.id=$1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Vehicle not found.' });

    const [drivers, mileage, fuel, maint] = await Promise.all([
      db.query(`SELECT d.*, vd.is_primary, vd.assigned_date
                FROM fleet_vehicle_drivers vd JOIN fleet_drivers d ON d.id=vd.driver_id
                WHERE vd.vehicle_id=$1 AND vd.unassigned_date IS NULL
                ORDER BY vd.is_primary DESC, d.full_name`, [req.params.id]),
      db.query(`SELECT ml.*, d.full_name AS driver_name
                FROM fleet_mileage_logs ml JOIN fleet_drivers d ON d.id=ml.driver_id
                WHERE ml.vehicle_id=$1 ORDER BY ml.trip_date DESC LIMIT 20`, [req.params.id]),
      db.query(`SELECT * FROM fleet_fuel_logs WHERE vehicle_id=$1 ORDER BY fuel_date DESC LIMIT 20`, [req.params.id]),
      db.query(`SELECT * FROM fleet_maintenance_records WHERE vehicle_id=$1 ORDER BY service_date DESC LIMIT 20`, [req.params.id]),
    ]);
    return res.json({ ...rows[0], drivers: drivers.rows, recent_mileage: mileage.rows, recent_fuel: fuel.rows, recent_maintenance: maint.rows });
  } catch (err) { next(err); }
}

async function createVehicle(req, res, next) {
  try {
    const { registration_number, make, model, year_of_manufacture, chassis_number, engine_number,
            department_id, fuel_type, tank_capacity_litres, service_interval_km,
            insurance_expiry, roadworthy_expiry, current_odometer_km, notes } = req.body;
    if (!registration_number || !make || !model)
      return res.status(400).json({ error: 'registration_number, make and model are required.' });
    const { rows: [v] } = await db.query(`
      INSERT INTO fleet_vehicles
        (registration_number,make,model,year_of_manufacture,chassis_number,engine_number,
         department_id,fuel_type,tank_capacity_litres,service_interval_km,
         insurance_expiry,roadworthy_expiry,current_odometer_km,notes,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *
    `, [registration_number.toUpperCase(), make, model, year_of_manufacture||null,
        chassis_number||null, engine_number||null, department_id||null,
        fuel_type||'diesel', tank_capacity_litres||null, service_interval_km||5000,
        insurance_expiry||null, roadworthy_expiry||null, current_odometer_km||0,
        notes||null, req.user.id]);
    await logAudit(req, 'fleet:vehicle_created', 'fleet_vehicles', v.id, { registration_number });
    return res.status(201).json(v);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Registration number or chassis number already exists.' });
    next(err);
  }
}

async function updateVehicle(req, res, next) {
  try {
    const { registration_number, make, model, year_of_manufacture, chassis_number, engine_number,
            department_id, fuel_type, tank_capacity_litres, service_interval_km,
            insurance_expiry, roadworthy_expiry, current_odometer_km, notes } = req.body;
    const { rows: [v] } = await db.query(`
      UPDATE fleet_vehicles SET
        registration_number=$1, make=$2, model=$3, year_of_manufacture=$4,
        chassis_number=$5, engine_number=$6, department_id=$7, fuel_type=$8,
        tank_capacity_litres=$9, service_interval_km=$10, insurance_expiry=$11,
        roadworthy_expiry=$12, current_odometer_km=$13, notes=$14, updated_at=NOW()
      WHERE id=$15 RETURNING *
    `, [registration_number, make, model, year_of_manufacture||null,
        chassis_number||null, engine_number||null, department_id||null,
        fuel_type||'diesel', tank_capacity_litres||null, service_interval_km||5000,
        insurance_expiry||null, roadworthy_expiry||null, current_odometer_km||0,
        notes||null, req.params.id]);
    if (!v) return res.status(404).json({ error: 'Vehicle not found.' });
    await logAudit(req, 'fleet:vehicle_updated', 'fleet_vehicles', v.id, req.body);
    return res.json(v);
  } catch (err) { next(err); }
}

async function setVehicleStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!['active','under_maintenance','out_of_service'].includes(status))
      return res.status(400).json({ error: 'Invalid status.' });
    const { rows: [v] } = await db.query(
      `UPDATE fleet_vehicles SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *`,
      [status, req.params.id]
    );
    if (!v) return res.status(404).json({ error: 'Vehicle not found.' });
    return res.json(v);
  } catch (err) { next(err); }
}

async function assignDriver(req, res, next) {
  try {
    const { driver_id, is_primary } = req.body;
    const { rows: [a] } = await db.query(`
      INSERT INTO fleet_vehicle_drivers (vehicle_id, driver_id, is_primary)
      VALUES ($1,$2,$3)
      ON CONFLICT (vehicle_id, driver_id) DO UPDATE SET is_primary=$3, unassigned_date=NULL
      RETURNING *
    `, [req.params.id, driver_id, !!is_primary]);
    return res.status(201).json(a);
  } catch (err) { next(err); }
}

async function unassignDriver(req, res, next) {
  try {
    await db.query(
      `UPDATE fleet_vehicle_drivers SET unassigned_date=CURRENT_DATE WHERE vehicle_id=$1 AND driver_id=$2`,
      [req.params.id, req.params.driverId]
    );
    return res.json({ message: 'Driver unassigned.' });
  } catch (err) { next(err); }
}

// ─── Drivers ──────────────────────────────────────────────────────────────────
async function listDrivers(req, res, next) {
  try {
    const { status, search } = req.query;
    const cond = ['1=1']; const p = [];
    if (status) { p.push(status); cond.push(`d.status=$${p.length}`); }
    if (search) { p.push(`%${search}%`); cond.push(`(d.full_name ILIKE $${p.length} OR d.license_number ILIKE $${p.length} OR d.employee_number ILIKE $${p.length})`); }
    const { rows } = await db.query(`
      SELECT d.*, t.label AS department_name,
        (SELECT json_agg(json_build_object('id',v.id,'registration_number',v.registration_number,'make',v.make,'model',v.model,'is_primary',vd.is_primary))
         FROM fleet_vehicle_drivers vd JOIN fleet_vehicles v ON v.id=vd.vehicle_id
         WHERE vd.driver_id=d.id AND vd.unassigned_date IS NULL) AS assigned_vehicles,
        (SELECT COUNT(*)::INT FROM fleet_mileage_logs
         WHERE driver_id=d.id AND trip_date >= DATE_TRUNC('month',NOW())) AS trips_this_month
      FROM fleet_drivers d
      LEFT JOIN lms_teams t ON t.id=d.department_id
      WHERE ${cond.join(' AND ')}
      ORDER BY d.full_name
    `, p);
    return res.json(rows);
  } catch (err) { next(err); }
}

async function createDriver(req, res, next) {
  try {
    const { staff_id, employee_number, full_name, phone, license_number, license_class, license_expiry, department_id } = req.body;
    if (!full_name || !license_number || !license_expiry)
      return res.status(400).json({ error: 'full_name, license_number and license_expiry are required.' });
    const { rows: [d] } = await db.query(`
      INSERT INTO fleet_drivers (staff_id,employee_number,full_name,phone,license_number,license_class,license_expiry,department_id,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [staff_id||null, employee_number||null, full_name, phone||null,
        license_number, license_class||null, license_expiry, department_id||null, req.user.id]);
    await logAudit(req, 'fleet:driver_created', 'fleet_drivers', d.id, { full_name, license_number });
    return res.status(201).json(d);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'License number or employee number already exists.' });
    next(err);
  }
}

async function updateDriver(req, res, next) {
  try {
    const { employee_number, full_name, phone, license_number, license_class, license_expiry, department_id, status } = req.body;
    const { rows: [d] } = await db.query(`
      UPDATE fleet_drivers SET employee_number=$1,full_name=$2,phone=$3,license_number=$4,
        license_class=$5,license_expiry=$6,department_id=$7,status=$8,updated_at=NOW()
      WHERE id=$9 RETURNING *
    `, [employee_number||null, full_name, phone||null, license_number,
        license_class||null, license_expiry, department_id||null, status||'active', req.params.id]);
    if (!d) return res.status(404).json({ error: 'Driver not found.' });
    await logAudit(req, 'fleet:driver_updated', 'fleet_drivers', d.id, req.body);
    return res.json(d);
  } catch (err) { next(err); }
}

// ─── Mileage Logs ─────────────────────────────────────────────────────────────
async function listMileageLogs(req, res, next) {
  try {
    const { vehicle_id, driver_id, status, from, to, limit=50, offset=0 } = req.query;
    const cond = ['1=1']; const p = [];
    if (vehicle_id) { p.push(vehicle_id); cond.push(`ml.vehicle_id=$${p.length}`); }
    if (driver_id)  { p.push(driver_id);  cond.push(`ml.driver_id=$${p.length}`); }
    if (status)     { p.push(status);     cond.push(`ml.status=$${p.length}`); }
    if (from)       { p.push(from);       cond.push(`ml.trip_date>=$${p.length}`); }
    if (to)         { p.push(to);         cond.push(`ml.trip_date<=$${p.length}`); }
    p.push(parseInt(limit)); p.push(parseInt(offset));
    const { rows } = await db.query(`
      SELECT ml.*, v.registration_number, v.make, v.model, d.full_name AS driver_name
      FROM fleet_mileage_logs ml
      JOIN fleet_vehicles v ON v.id=ml.vehicle_id
      JOIN fleet_drivers  d ON d.id=ml.driver_id
      WHERE ${cond.join(' AND ')}
      ORDER BY ml.trip_date DESC, ml.created_at DESC
      LIMIT $${p.length-1} OFFSET $${p.length}
    `, p);
    return res.json(rows);
  } catch (err) { next(err); }
}

async function createMileageLog(req, res, next) {
  try {
    const { vehicle_id, driver_id, trip_date, trip_start_time, trip_end_time,
            odometer_start, odometer_end, trip_purpose, origin, destination,
            fuel_added_litres, fuel_cost, remarks } = req.body;
    if (!vehicle_id || !driver_id || odometer_start == null || odometer_end == null || !trip_purpose)
      return res.status(400).json({ error: 'vehicle_id, driver_id, odometer readings and trip_purpose are required.' });
    if (parseFloat(odometer_end) < parseFloat(odometer_start))
      return res.status(400).json({ error: 'Odometer end cannot be less than odometer start.' });

    const dist = parseFloat(odometer_end) - parseFloat(odometer_start);
    const is_flagged  = dist > 500 || dist === 0;
    const flag_reason = dist > 500 ? `Abnormal distance: ${dist} km in one trip`
                      : dist === 0 ? 'Zero distance trip' : null;

    const { rows: [log] } = await db.query(`
      INSERT INTO fleet_mileage_logs
        (vehicle_id,driver_id,trip_date,trip_start_time,trip_end_time,
         odometer_start,odometer_end,trip_purpose,origin,destination,
         fuel_added_litres,fuel_cost,is_flagged,flag_reason,remarks,recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *
    `, [vehicle_id, driver_id, trip_date||new Date().toISOString().slice(0,10),
        trip_start_time||null, trip_end_time||null,
        odometer_start, odometer_end, trip_purpose, origin||null, destination||null,
        fuel_added_litres||null, fuel_cost||null, is_flagged, flag_reason, remarks||null, req.user.id]);

    await db.query(
      `UPDATE fleet_vehicles SET current_odometer_km=GREATEST(current_odometer_km,$1),updated_at=NOW() WHERE id=$2`,
      [odometer_end, vehicle_id]
    );

    if (is_flagged) {
      await db.query(
        `INSERT INTO fleet_alerts (vehicle_id,alert_type,message) VALUES ($1,'abnormal_mileage',$2)`,
        [vehicle_id, `Flagged trip logged: ${flag_reason}`]
      );
    }
    await logAudit(req, 'fleet:mileage_logged', 'fleet_mileage_logs', log.id, { vehicle_id, distance_km: dist });
    return res.status(201).json(log);
  } catch (err) { next(err); }
}

async function approveMileageLog(req, res, next) {
  try {
    const { rows: [log] } = await db.query(`
      UPDATE fleet_mileage_logs SET status='approved',approved_by=$1,approved_at=NOW(),updated_at=NOW()
      WHERE id=$2 AND status='pending' RETURNING *
    `, [req.user.id, req.params.id]);
    if (!log) return res.status(404).json({ error: 'Log not found or already processed.' });
    return res.json(log);
  } catch (err) { next(err); }
}

async function rejectMileageLog(req, res, next) {
  try {
    const { reason } = req.body;
    const { rows: [log] } = await db.query(`
      UPDATE fleet_mileage_logs
      SET status='rejected',approved_by=$1,approved_at=NOW(),
          remarks=COALESCE(remarks||' | ','') || 'Rejected: ' || $2,updated_at=NOW()
      WHERE id=$3 AND status='pending' RETURNING *
    `, [req.user.id, reason||'No reason given', req.params.id]);
    if (!log) return res.status(404).json({ error: 'Log not found or already processed.' });
    return res.json(log);
  } catch (err) { next(err); }
}

// ─── Fuel Logs ────────────────────────────────────────────────────────────────
async function listFuelLogs(req, res, next) {
  try {
    const { vehicle_id, from, to } = req.query;
    const cond = ['1=1']; const p = [];
    if (vehicle_id) { p.push(vehicle_id); cond.push(`fl.vehicle_id=$${p.length}`); }
    if (from)       { p.push(from);       cond.push(`fl.fuel_date>=$${p.length}`); }
    if (to)         { p.push(to);         cond.push(`fl.fuel_date<=$${p.length}`); }
    const { rows } = await db.query(`
      SELECT fl.*, v.registration_number, v.make, v.model, d.full_name AS driver_name
      FROM fleet_fuel_logs fl
      JOIN fleet_vehicles v ON v.id=fl.vehicle_id
      LEFT JOIN fleet_drivers d ON d.id=fl.driver_id
      WHERE ${cond.join(' AND ')}
      ORDER BY fl.fuel_date DESC, fl.created_at DESC LIMIT 100
    `, p);
    return res.json(rows);
  } catch (err) { next(err); }
}

async function createFuelLog(req, res, next) {
  try {
    const { vehicle_id, driver_id, fuel_date, litres, cost_per_litre, total_cost, odometer_km, fuel_station, receipt_number } = req.body;
    if (!vehicle_id || !litres || !odometer_km)
      return res.status(400).json({ error: 'vehicle_id, litres and odometer_km are required.' });
    const calcTotal = total_cost || (cost_per_litre ? parseFloat(litres)*parseFloat(cost_per_litre) : null);
    const { rows: [log] } = await db.query(`
      INSERT INTO fleet_fuel_logs (vehicle_id,driver_id,fuel_date,litres,cost_per_litre,total_cost,odometer_km,fuel_station,receipt_number,recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [vehicle_id, driver_id||null, fuel_date||new Date().toISOString().slice(0,10),
        litres, cost_per_litre||null, calcTotal, odometer_km,
        fuel_station||null, receipt_number||null, req.user.id]);
    await logAudit(req, 'fleet:fuel_logged', 'fleet_fuel_logs', log.id, { vehicle_id, litres });
    return res.status(201).json(log);
  } catch (err) { next(err); }
}

// ─── Maintenance ──────────────────────────────────────────────────────────────
async function listMaintenance(req, res, next) {
  try {
    const { vehicle_id, status, from, to } = req.query;
    const cond = ['1=1']; const p = [];
    if (vehicle_id) { p.push(vehicle_id); cond.push(`mr.vehicle_id=$${p.length}`); }
    if (status)     { p.push(status);     cond.push(`mr.status=$${p.length}`); }
    if (from)       { p.push(from);       cond.push(`mr.service_date>=$${p.length}`); }
    if (to)         { p.push(to);         cond.push(`mr.service_date<=$${p.length}`); }
    const { rows } = await db.query(`
      SELECT mr.*, v.registration_number, v.make, v.model,
        CASE WHEN mr.end_date IS NOT NULL THEN (mr.end_date-mr.start_date)::INT ELSE NULL END AS downtime_days
      FROM fleet_maintenance_records mr
      JOIN fleet_vehicles v ON v.id=mr.vehicle_id
      WHERE ${cond.join(' AND ')}
      ORDER BY mr.service_date DESC LIMIT 100
    `, p);
    return res.json(rows);
  } catch (err) { next(err); }
}

async function createMaintenance(req, res, next) {
  try {
    const { vehicle_id, maintenance_type, description, workshop, cost,
            service_date, odometer_at_service, start_date, end_date, status } = req.body;
    if (!vehicle_id || !maintenance_type || !description || !service_date)
      return res.status(400).json({ error: 'vehicle_id, maintenance_type, description and service_date are required.' });

    const veh = await db.query(`SELECT service_interval_km FROM fleet_vehicles WHERE id=$1`, [vehicle_id]);
    if (!veh.rows[0]) return res.status(404).json({ error: 'Vehicle not found.' });
    const interval = veh.rows[0].service_interval_km || 5000;
    const nextKm   = odometer_at_service ? parseFloat(odometer_at_service) + interval : null;

    const { rows: [mr] } = await db.query(`
      INSERT INTO fleet_maintenance_records
        (vehicle_id,maintenance_type,description,workshop,cost,service_date,
         odometer_at_service,next_service_km,start_date,end_date,status,recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
    `, [vehicle_id, maintenance_type, description, workshop||null, cost||null, service_date,
        odometer_at_service||null, nextKm, start_date||service_date, end_date||null,
        status||'scheduled', req.user.id]);

    if ((status||'scheduled') === 'in_progress') {
      await db.query(`UPDATE fleet_vehicles SET status='under_maintenance',updated_at=NOW() WHERE id=$1`, [vehicle_id]);
    } else if ((status||'scheduled') === 'completed') {
      await db.query(`UPDATE fleet_vehicles SET status='active',updated_at=NOW() WHERE id=$1 AND status='under_maintenance'`, [vehicle_id]);
    }
    await logAudit(req, 'fleet:maintenance_created', 'fleet_maintenance_records', mr.id, { vehicle_id, maintenance_type });
    return res.status(201).json(mr);
  } catch (err) { next(err); }
}

async function updateMaintenance(req, res, next) {
  try {
    const { maintenance_type, description, workshop, cost, service_date,
            odometer_at_service, start_date, end_date, status } = req.body;
    const { rows: [mr] } = await db.query(`
      UPDATE fleet_maintenance_records SET
        maintenance_type=$1,description=$2,workshop=$3,cost=$4,service_date=$5,
        odometer_at_service=$6,start_date=$7,end_date=$8,status=$9,updated_at=NOW()
      WHERE id=$10 RETURNING *
    `, [maintenance_type, description, workshop||null, cost||null, service_date,
        odometer_at_service||null, start_date||null, end_date||null, status, req.params.id]);
    if (!mr) return res.status(404).json({ error: 'Record not found.' });
    if (status === 'completed') {
      await db.query(`UPDATE fleet_vehicles SET status='active',updated_at=NOW() WHERE id=$1 AND status='under_maintenance'`, [mr.vehicle_id]);
    }
    await logAudit(req, 'fleet:maintenance_updated', 'fleet_maintenance_records', mr.id, req.body);
    return res.json(mr);
  } catch (err) { next(err); }
}

// ─── Alerts ───────────────────────────────────────────────────────────────────
async function listAlerts(req, res, next) {
  try {
    const { rows } = await db.query(`
      SELECT fa.*, v.registration_number, d.full_name AS driver_name
      FROM fleet_alerts fa
      LEFT JOIN fleet_vehicles v ON v.id=fa.vehicle_id
      LEFT JOIN fleet_drivers  d ON d.id=fa.driver_id
      WHERE fa.is_dismissed=FALSE
      ORDER BY fa.created_at DESC LIMIT 50
    `);
    return res.json(rows);
  } catch (err) { next(err); }
}

async function dismissAlert(req, res, next) {
  try {
    await db.query(`UPDATE fleet_alerts SET is_dismissed=TRUE WHERE id=$1`, [req.params.id]);
    return res.json({ message: 'Alert dismissed.' });
  } catch (err) { next(err); }
}

module.exports = {
  getDashboard,
  listVehicles, getVehicle, createVehicle, updateVehicle, setVehicleStatus,
  assignDriver, unassignDriver,
  listDrivers, createDriver, updateDriver,
  listMileageLogs, createMileageLog, approveMileageLog, rejectMileageLog,
  listFuelLogs, createFuelLog,
  listMaintenance, createMaintenance, updateMaintenance,
  listAlerts, dismissAlert,
};
