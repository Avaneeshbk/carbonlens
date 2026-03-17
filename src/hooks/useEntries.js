import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { calculateEmissions } from '../lib/calculations'
import { useAuth } from './useAuth'

export function useEntries() {
  const { company } = useAuth()
  const [entries, setEntries] = useState([])
  const [calcs, setCalcs]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetchEntries = useCallback(async () => {
    if (!company?.id) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const { data: rows, error: e1 } = await supabase
        .from('monthly_entries')
        .select('*')
        .eq('company_id', company.id)
        .order('report_month', { ascending: true })
      if (e1) throw e1

      const ids = rows.map(r => r.id)
      let logRows = []
      if (ids.length > 0) {
        const { data: logs, error: e2 } = await supabase
          .from('logistics_entries').select('*').in('entry_id', ids)
        if (e2) throw e2
        logRows = logs
      }

      const byEntry = {}
      logRows.forEach(l => {
        if (!byEntry[l.entry_id]) byEntry[l.entry_id] = []
        byEntry[l.entry_id].push(l)
      })

      const enriched = rows.map(row => {
        const logs = byEntry[row.id] || []
        const calc = calculateEmissions(row, company.state, logs)
        return { ...row, calc, logistics: logs }
      })

      setEntries(enriched)
      setCalcs(enriched.map(e => ({ ...e.calc, month: e.report_month, id: e.id })))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [company?.id, company?.state])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  useEffect(() => {
    if (!company?.id) return
    const ch = supabase.channel('entries_rt')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'monthly_entries',
        filter: `company_id=eq.${company.id}`,
      }, fetchEntries)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [company?.id, fetchEntries])

  async function saveEntry(formData, logisticsRows) {
    if (!company?.id) throw new Error('No company — complete onboarding first')
    const calc = calculateEmissions(formData, company.state, logisticsRows)

    const { data: saved, error: e1 } = await supabase
      .from('monthly_entries')
      .upsert({
        company_id:       company.id,
        report_month:     formData.report_month,
        electricity_kwh:  parseFloat(formData.electricity_kwh)  || 0,
        solar_kwh:        parseFloat(formData.solar_kwh)         || 0,
        rec_kwh:          parseFloat(formData.rec_kwh)           || 0,
        fuel_diesel:      parseFloat(formData.fuel_diesel)       || 0,
        fuel_lpg:         parseFloat(formData.fuel_lpg)          || 0,
        fuel_coal:        parseFloat(formData.fuel_coal)         || 0,
        fuel_petrol:      parseFloat(formData.fuel_petrol)       || 0,
        fuel_cng:         parseFloat(formData.fuel_cng)          || 0,
        fuel_furnace_oil: parseFloat(formData.fuel_furnaceOil)   || 0,
        mat_steel:        parseFloat(formData.mat_steel)         || 0,
        mat_cement:       parseFloat(formData.mat_cement)        || 0,
        mat_aluminum:     parseFloat(formData.mat_aluminum)      || 0,
        mat_copper:       parseFloat(formData.mat_copper)        || 0,
        mat_plastic:      parseFloat(formData.mat_plastic)       || 0,
        mat_paper:        parseFloat(formData.mat_paper)         || 0,
        mat_glass:        parseFloat(formData.mat_glass)         || 0,
        mat_rubber:       parseFloat(formData.mat_rubber)        || 0,
        revenue_cr:       parseFloat(formData.revenue_cr)        || null,
        scope1_tco2e:     calc.scope1,
        scope2_tco2e:     calc.scope2,
        scope3_tco2e:     calc.scope3,
        total_tco2e:      calc.total,
        status:           'submitted',
      }, { onConflict: 'company_id,report_month' })
      .select().single()

    if (e1) throw e1

    await supabase.from('logistics_entries').delete().eq('entry_id', saved.id)
    const validLogs = logisticsRows.filter(l =>
      (parseFloat(l.tonnes) || 0) > 0 && (parseFloat(l.distance_km) || 0) > 0
    )
    if (validLogs.length > 0) {
      const { error: e2 } = await supabase.from('logistics_entries').insert(
        validLogs.map(l => ({
          entry_id: saved.id, mode: l.mode,
          tonnes: parseFloat(l.tonnes), distance_km: parseFloat(l.distance_km),
        }))
      )
      if (e2) throw e2
    }

    await fetchEntries()
    return saved
  }

  async function deleteEntry(id) {
    const { error } = await supabase.from('monthly_entries').delete().eq('id', id)
    if (error) throw error
    await fetchEntries()
  }

  return { entries, calcs, loading, error, saveEntry, deleteEntry, refresh: fetchEntries }
}
