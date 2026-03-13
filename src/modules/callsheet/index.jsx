// ── Call Sheet — Folha de Serviço Interactiva ─────────────────────
// Documento vivo do dia de rodagem
// Weather, localização, cenas, notas por departamento, walkie, RSVP,
// camera reports, export editorial (EDL/XML/ALE)

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Cloud, MapPin, Clock, Users, Sunrise, Sunset,
  Wind, Droplets, ChevronDown, ChevronRight, Radio, Coffee,
  Download, Camera, Heart, AlertTriangle, CheckCircle, ExternalLink, Plus, ArrowLeft,
  MessageCircle, Send, Utensils, Printer, Quote, Thermometer,
  Aperture, Trash2, Star,
} from 'lucide-react'
import { useStore } from '../../core/store.js'
import { useShallow } from 'zustand/react/shallow'
import { useShootingStore } from '../../core/shootingStore.js'
import { useScheduleEngine } from '../production/schedule/hooks/useScheduleEngine.js'
import { resolveRole, ROLES, DEPARTMENTS, isAdmin } from '../../core/roles.js'
import { fetchWeather, fetchSunTimes, detectWeatherAlerts, weatherIcon } from './weather.js'
import { SunlightCalculator } from '../../components/embeds/SunlightCalculator.jsx'
import { generateFCPXML, generateEDL, generateALE, generateCameraReportText, downloadFile } from './exporters.js'
import { resolveLocation } from '../../utils/locationResolver.js'
import { buildCallMessage, buildActorCallMessage, openWhatsApp } from '../../utils/whatsapp.js'
import styles from './CallSheet.module.css'

// Minutes since midnight → "HH:MM" string
function minToTimeStr(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ── PDF generation via jsPDF (lazy) ──────────────────────────────

// Colors used in the PDF
const PDF_COLORS = {
  primary: [42, 42, 54],       // dark header text
  accent: [91, 141, 239],      // blue accent
  accentDark: [55, 90, 160],
  muted: [130, 130, 145],
  white: [255, 255, 255],
  rowAlt: [245, 246, 250],
  sectionBar: [91, 141, 239],
  lunch: [255, 248, 225],
  lunchBorder: [251, 191, 36],
  move: [255, 243, 224],
  divider: [220, 222, 230],
  black: [30, 30, 38],
  green: [16, 185, 129],
  red: [239, 68, 68],
}

// Helper: hex color string → [r,g,b]
function hexToRgb(hex) {
  const c = hex.replace('#', '')
  return [parseInt(c.substring(0, 2), 16), parseInt(c.substring(2, 4), 16), parseInt(c.substring(4, 6), 16)]
}

// Helper: truncate text to fit width
function truncText(doc, text, maxW) {
  if (!text) return ''
  if (doc.getTextWidth(text) <= maxW) return text
  let t = text
  while (t.length > 0 && doc.getTextWidth(t + '...') > maxW) t = t.slice(0, -1)
  return t + '...'
}

// Check page break — returns new Y if page was added
function checkPageBreak(doc, y, needed = 20, margin = 20) {
  const pageH = doc.internal.pageSize.getHeight()
  if (y + needed > pageH - margin) {
    doc.addPage()
    return 30
  }
  return y
}

// Draw a section header bar
function drawSectionHeader(doc, y, title, color = PDF_COLORS.sectionBar, margin = 15) {
  y = checkPageBreak(doc, y, 16, margin)
  const pageW = doc.internal.pageSize.getWidth()
  doc.setFillColor(...color)
  doc.rect(margin, y, pageW - margin * 2, 8, 'F')
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...PDF_COLORS.white)
  doc.text(title.toUpperCase(), margin + 4, y + 5.5)
  doc.setTextColor(...PDF_COLORS.primary)
  return y + 12
}

// Draw a table header row
function drawTableHeader(doc, y, cols, margin = 15) {
  y = checkPageBreak(doc, y, 12)
  const pageW = doc.internal.pageSize.getWidth()
  doc.setFillColor(235, 237, 243)
  doc.rect(margin, y, pageW - margin * 2, 7, 'F')
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...PDF_COLORS.muted)
  let x = margin + 2
  cols.forEach(col => {
    doc.text(col.label.toUpperCase(), x, y + 5)
    x += col.width
  })
  doc.setTextColor(...PDF_COLORS.primary)
  return y + 9
}

// Draw a table row with alternating color
function drawTableRow(doc, y, cols, values, rowIdx, margin = 15, rowH = 7) {
  y = checkPageBreak(doc, y, rowH + 2)
  const pageW = doc.internal.pageSize.getWidth()
  if (rowIdx % 2 === 1) {
    doc.setFillColor(...PDF_COLORS.rowAlt)
    doc.rect(margin, y, pageW - margin * 2, rowH, 'F')
  }
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...PDF_COLORS.primary)
  let x = margin + 2
  cols.forEach((col, i) => {
    const val = String(values[i] || '')
    const maxW = col.width - 4
    if (col.bold) doc.setFont('Helvetica', 'bold')
    doc.text(truncText(doc, val, maxW), x, y + 5)
    if (col.bold) doc.setFont('Helvetica', 'normal')
    x += col.width
  })
  return y + rowH
}

// ── MAIN PDF EXPORT ───────────────────────────────────────────────
async function exportCallsheetPDF({ projectName, dayData, dayIndex, callTime, engineDay, sunTimes, dayScenes, parsedScripts, dayLocation, team, weather, deptNotes, walkieChannels, catering }) {
  const { jsPDF } = await import('jspdf')
  const TURNAROUND = 10
  const dayNum = dayData?.dayNumber || (dayIndex + 1)
  const date = dayData?.date || ''
  const pageMargin = 15
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()  // 210
  const contentW = pageW - pageMargin * 2          // 180

  let y = pageMargin

  // ── HEADER ──────────────────────────────────────────────────────
  // Top bar
  doc.setFillColor(...PDF_COLORS.accent)
  doc.rect(0, 0, pageW, 3, 'F')

  y = 12
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...PDF_COLORS.black)
  doc.text(projectName || 'Projecto', pageMargin, y)

  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...PDF_COLORS.accent)
  doc.text('FOLHA DE SERVICO', pageW - pageMargin, y, { align: 'right' })

  y += 6
  doc.setFontSize(10)
  doc.setTextColor(...PDF_COLORS.primary)
  doc.setFont('Helvetica', 'bold')
  const dateLabel = date ? (() => {
    try {
      return new Date(date + 'T00:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    } catch { return date }
  })() : ''
  doc.text(`Dia ${dayNum}` + (dateLabel ? ` — ${dateLabel}` : ''), pageMargin, y)

  y += 5
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...PDF_COLORS.muted)
  const metaParts = [
    `Call: ${engineDay?.callTime || callTime}`,
    `Wrap: ${engineDay?.wrapTime || '—'}`,
    `${dayScenes.length} cenas`,
  ]
  if (sunTimes) {
    metaParts.push(`Nascer: ${sunTimes.sunrise}`)
    metaParts.push(`Por-do-sol: ${sunTimes.sunset}`)
  }
  doc.text(metaParts.join('  |  '), pageMargin, y)

  // Divider
  y += 4
  doc.setDrawColor(...PDF_COLORS.divider)
  doc.setLineWidth(0.3)
  doc.line(pageMargin, y, pageW - pageMargin, y)
  y += 6

  // ── SECTION 1: GENERAL INFO ─────────────────────────────────────
  y = drawSectionHeader(doc, y, 'Informacao Geral')

  const infoRows = [
    ['Call Geral', engineDay?.callTime || callTime],
    ['Wrap Previsto', engineDay?.wrapTime || '—'],
    ['Cenas', `${dayScenes.length} cenas programadas`],
  ]
  if (engineDay?.utilization) {
    infoRows.push(['Utilizacao', `${engineDay.utilization}%`])
  }
  if (weather?.current) {
    const wDesc = `${weather.current.temp || ''}C ${weather.current.description || ''}`.trim()
    const wExtra = []
    if (weather.current.wind?.speed) wExtra.push(`Vento: ${weather.current.wind.speed} km/h`)
    if (weather.current.humidity) wExtra.push(`Humidade: ${weather.current.humidity}%`)
    infoRows.push(['Meteorologia', wDesc + (wExtra.length ? ' | ' + wExtra.join(', ') : '')])
  }
  if (sunTimes?.goldenHour) {
    infoRows.push(['Golden Hour', sunTimes.goldenHour])
  }

  doc.setFontSize(8)
  infoRows.forEach(([label, value], i) => {
    y = checkPageBreak(doc, y, 7)
    if (i % 2 === 1) {
      doc.setFillColor(...PDF_COLORS.rowAlt)
      doc.rect(pageMargin, y, contentW, 7, 'F')
    }
    doc.setFont('Helvetica', 'bold')
    doc.setTextColor(...PDF_COLORS.muted)
    doc.text(label, pageMargin + 2, y + 5)
    doc.setFont('Helvetica', 'normal')
    doc.setTextColor(...PDF_COLORS.primary)
    doc.text(String(value), pageMargin + 50, y + 5)
    y += 7
  })
  y += 4

  // ── SECTION 2: LOCATION ─────────────────────────────────────────
  y = drawSectionHeader(doc, y, 'Local de Rodagem', hexToRgb('#2EA080'))

  if (dayLocation) {
    doc.setFont('Helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...PDF_COLORS.primary)
    doc.text(dayLocation.name || 'Local TBD', pageMargin + 2, y + 4)
    y += 7

    doc.setFont('Helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...PDF_COLORS.muted)

    if (dayLocation.address) {
      doc.text(`Morada: ${dayLocation.address}`, pageMargin + 2, y + 4)
      y += 6
    }
    if (dayLocation.parkingNotes) {
      doc.text(`Estacionamento: ${dayLocation.parkingNotes}`, pageMargin + 2, y + 4)
      y += 6
    }
    if (dayLocation.accessNotes) {
      doc.text(`Acesso: ${dayLocation.accessNotes}`, pageMargin + 2, y + 4)
      y += 6
    }
    if (dayLocation.nearestHospital) {
      const h = dayLocation.nearestHospital
      doc.setTextColor(...PDF_COLORS.red)
      doc.setFont('Helvetica', 'bold')
      doc.text(`Hospital: ${h.name || ''}${h.distance ? ' (' + h.distance + ')' : ''}${h.phone ? ' — Tel: ' + h.phone : ''}`, pageMargin + 2, y + 4)
      doc.setTextColor(...PDF_COLORS.primary)
      doc.setFont('Helvetica', 'normal')
      y += 6
    }
    if (dayLocation.lat && dayLocation.lng) {
      doc.setTextColor(...PDF_COLORS.accent)
      doc.text(`GPS: ${dayLocation.lat.toFixed(5)}, ${dayLocation.lng.toFixed(5)}`, pageMargin + 2, y + 4)
      doc.setTextColor(...PDF_COLORS.primary)
      y += 6
    }
  } else {
    doc.setFontSize(8)
    doc.setTextColor(...PDF_COLORS.muted)
    doc.text('Local nao definido', pageMargin + 2, y + 4)
    y += 7
  }
  y += 4

  // ── SECTION 3: SCENES TABLE ─────────────────────────────────────
  y = drawSectionHeader(doc, y, 'Plano Horario — Cenas do Dia')

  const sceneCols = [
    { label: 'Hora', width: 30 },
    { label: 'Cena', width: 22, bold: true },
    { label: 'Tipo', width: 22 },
    { label: 'Descricao', width: 80 },
    { label: 'Elenco', width: 30 },
    { label: 'Dur.', width: contentW - 30 - 22 - 22 - 80 - 30 },
  ]
  y = drawTableHeader(doc, y, sceneCols)

  let sceneRowIdx = 0
  ;(engineDay?.blocos || []).forEach((bloco, i, arr) => {
    const prevBloco = i > 0 ? arr[i - 1] : null
    const gapMin = prevBloco ? (bloco.inicio_min || 0) - (prevBloco.fim_min || 0) - (bloco.move_antes || 0) : 0

    // Buffer/gap row
    if (gapMin > 5 && prevBloco) {
      y = checkPageBreak(doc, y, 7)
      doc.setFillColor(250, 250, 252)
      doc.rect(pageMargin, y, contentW, 6, 'F')
      doc.setFont('Helvetica', 'italic')
      doc.setFontSize(7)
      doc.setTextColor(...PDF_COLORS.muted)
      doc.text(`${minToTimeStr(prevBloco.fim_min)} -> ${minToTimeStr(bloco.inicio_min - (bloco.move_antes || 0))}  Buffer / Preparacao (${gapMin}min)`, pageMargin + 2, y + 4)
      y += 6
    }

    // Move row
    if (bloco.move_antes > 0) {
      y = checkPageBreak(doc, y, 7)
      doc.setFillColor(...PDF_COLORS.move)
      doc.rect(pageMargin, y, contentW, 6, 'F')
      doc.setFont('Helvetica', 'italic')
      doc.setFontSize(7)
      doc.setTextColor(200, 120, 30)
      doc.text(`${minToTimeStr((bloco.inicio_min || 0) - bloco.move_antes)} -> ${minToTimeStr(bloco.inicio_min || 0)}  DESLOCACAO para ${bloco.location} (${bloco.move_antes}min)`, pageMargin + 2, y + 4)
      doc.setTextColor(...PDF_COLORS.primary)
      y += 6
    }

    // Lunch row
    if (bloco.tipo === 'almoco') {
      y = checkPageBreak(doc, y, 9)
      doc.setFillColor(...PDF_COLORS.lunch)
      doc.rect(pageMargin, y, contentW, 8, 'F')
      doc.setDrawColor(...PDF_COLORS.lunchBorder)
      doc.setLineWidth(0.4)
      doc.line(pageMargin, y, pageMargin, y + 8)
      doc.line(pageMargin + contentW, y, pageMargin + contentW, y + 8)
      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(160, 120, 20)
      doc.text(`${bloco.hora_inicio} -> ${bloco.hora_fim}   ALMOCO (${bloco.duracao}min) — PAUSA OBRIGATORIA`, pageMargin + 4, y + 5.5)
      doc.setTextColor(...PDF_COLORS.primary)
      y += 10
      return
    }

    // Block header
    y = checkPageBreak(doc, y, 9)
    const blockColor = bloco.color ? hexToRgb(bloco.color) : PDF_COLORS.accent
    doc.setFillColor(blockColor[0], blockColor[1], blockColor[2], 0.08)
    doc.setFillColor(Math.min(blockColor[0] + 190, 250), Math.min(blockColor[1] + 190, 250), Math.min(blockColor[2] + 190, 250))
    doc.rect(pageMargin, y, contentW, 7, 'F')
    doc.setDrawColor(...blockColor)
    doc.setLineWidth(0.8)
    doc.line(pageMargin, y, pageMargin, y + 7)
    doc.setFont('Helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...blockColor)
    doc.text(`${bloco.hora_inicio} -> ${bloco.hora_fim}`, pageMargin + 3, y + 5)
    doc.setTextColor(...PDF_COLORS.primary)
    doc.text(bloco.location || '', pageMargin + 34, y + 5)
    doc.setFont('Helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...PDF_COLORS.muted)
    doc.text(`${bloco.num_cenas} cena${bloco.num_cenas !== 1 ? 's' : ''} | ${bloco.duracao}min`, pageW - pageMargin - 2, y + 5, { align: 'right' })
    doc.setTextColor(...PDF_COLORS.primary)
    y += 8

    // Scene rows in this block
    let cursor = bloco.inicio_min || 0
    ;(bloco.cenas || []).forEach((sc, j) => {
      if (j > 0) cursor += TURNAROUND
      const start = cursor
      cursor += sc.duration || 0
      const [epId, scNum] = (sc.sceneKey || '').split('-')
      const fullScene = parsedScripts?.[epId]?.scenes?.find(s => String(s.sceneNumber) === scNum)
      const desc = (fullScene?.action?.[0] || fullScene?.heading?.full || '').slice(0, 120)
      const chars = (sc.characters || []).slice(0, 4).join(', ')

      y = drawTableRow(doc, y, sceneCols, [
        `${minToTimeStr(start)}-${minToTimeStr(cursor)}`,
        sc.sceneKey || '',
        `${sc.intExt || ''} ${sc.sceneType || ''}`.trim(),
        desc,
        chars,
        `${sc.duration || 0}min`,
      ], sceneRowIdx++)
    })
  })

  // Fallback if no engine data: render dayScenes directly
  if (!engineDay?.blocos?.length && dayScenes.length > 0) {
    dayScenes.forEach((scene, i) => {
      y = drawTableRow(doc, y, sceneCols, [
        '',
        `Sc.${scene.sceneNumber}`,
        `${scene.intExt || ''} ${scene.dayNight || ''}`.trim(),
        scene.description || scene.location || '',
        (scene.characters || []).slice(0, 4).join(', '),
        scene.pages ? `${scene.pages}pg` : '',
      ], i)
    })
  }
  y += 4

  // ── SECTION 4: CAST ─────────────────────────────────────────────
  const castMap = new Map()
  ;(engineDay?.blocos || []).forEach(bloco => {
    if (bloco.tipo === 'almoco') return
    let cursor = bloco.inicio_min || 0
    ;(bloco.cenas || []).forEach((sc, j) => {
      if (j > 0) cursor += TURNAROUND
      const end = cursor + (sc.duration || 0)
      ;(sc.characters || []).forEach(c => {
        if (!castMap.has(c)) castMap.set(c, { first: cursor, last: end, scenes: 1 })
        else { const p = castMap.get(c); p.last = Math.max(p.last, end); p.first = Math.min(p.first, cursor); p.scenes++ }
      })
      cursor = end
    })
  })

  if (castMap.size > 0) {
    y = drawSectionHeader(doc, y, 'Elenco do Dia', hexToRgb('#FF6B6B'))
    const castCols = [
      { label: 'Actor / Personagem', width: 60, bold: true },
      { label: 'Convocacao', width: 30 },
      { label: 'Periodo', width: 40 },
      { label: 'Cenas', width: 20 },
      { label: 'Dispensa', width: contentW - 60 - 30 - 40 - 20 },
    ]
    y = drawTableHeader(doc, y, castCols)

    const castList = [...castMap.entries()].sort((a, b) => a[1].first - b[1].first)
    const lastBlockEnd = engineDay?.blocos?.[engineDay.blocos.length - 1]?.fim_min || 999
    castList.forEach(([name, d], i) => {
      const convocacao = minToTimeStr(Math.max(0, d.first - 60)) // 1h before first scene
      const dispensa = d.last < lastBlockEnd ? minToTimeStr(d.last) : '—'
      y = drawTableRow(doc, y, castCols, [
        name,
        convocacao,
        `${minToTimeStr(d.first)} -> ${minToTimeStr(d.last)}`,
        `${d.scenes}`,
        dispensa,
      ], i)
    })
    y += 4
  }

  // ── SECTION 5: CREW LIST ────────────────────────────────────────
  if (team && team.length > 0) {
    y = drawSectionHeader(doc, y, 'Equipa', hexToRgb('#8B6FBF'))
    const crewCols = [
      { label: 'Nome', width: 50, bold: true },
      { label: 'Funcao', width: 45 },
      { label: 'Departamento', width: 35 },
      { label: 'Call', width: 20 },
      { label: 'Telefone', width: contentW - 50 - 45 - 35 - 20 },
    ]
    y = drawTableHeader(doc, y, crewCols)

    const sortedTeam = [...team].sort((a, b) => (a.group || '').localeCompare(b.group || ''))
    sortedTeam.forEach((m, i) => {
      const roleDef = m.role ? (ROLES[m.role] || ROLES[resolveRole(m.role)]) : null
      const roleLabel = roleDef?.label || m.role || m.function || ''
      const deptId = roleDef?.dept || m.department || m.group || ''
      const deptDef = Object.values(DEPARTMENTS).find(d => d.id === deptId)
      const deptLabel = deptDef?.label || deptId || ''
      y = drawTableRow(doc, y, crewCols, [
        m.name || '',
        roleLabel,
        deptLabel,
        m.callTime || callTime || '',
        m.phone || m.whatsapp || '',
      ], i)
    })
    y += 4
  }

  // ── SECTION 6: CATERING ─────────────────────────────────────────
  const cateringData = catering || dayData?.catering
  if (cateringData && (cateringData.time || cateringData.location || cateringData.provider)) {
    y = drawSectionHeader(doc, y, 'Catering / Almoco', hexToRgb('#F5A623'))
    doc.setFontSize(8)
    doc.setFont('Helvetica', 'normal')
    doc.setTextColor(...PDF_COLORS.primary)

    const cateringInfo = []
    if (cateringData.time) cateringInfo.push(['Horario', cateringData.time])
    if (cateringData.location) cateringInfo.push(['Local', cateringData.location])
    if (cateringData.provider) cateringInfo.push(['Fornecedor', cateringData.provider])
    if (cateringData.menu) cateringInfo.push(['Menu', cateringData.menu])

    cateringInfo.forEach(([label, value], i) => {
      y = checkPageBreak(doc, y, 7)
      if (i % 2 === 1) {
        doc.setFillColor(...PDF_COLORS.rowAlt)
        doc.rect(pageMargin, y, contentW, 7, 'F')
      }
      doc.setFont('Helvetica', 'bold')
      doc.setTextColor(...PDF_COLORS.muted)
      doc.text(label, pageMargin + 2, y + 5)
      doc.setFont('Helvetica', 'normal')
      doc.setTextColor(...PDF_COLORS.primary)
      doc.text(String(value || ''), pageMargin + 40, y + 5)
      y += 7
    })
    y += 4
  }

  // ── SECTION 7: DEPARTMENT NOTES ─────────────────────────────────
  const deptNotesData = deptNotes || {}
  const activeDeptNotes = Object.entries(DEPT_LABELS).filter(([id]) => deptNotesData[id])
  if (activeDeptNotes.length > 0) {
    y = drawSectionHeader(doc, y, 'Notas por Departamento', hexToRgb('#E74C3C'))

    activeDeptNotes.forEach(([deptId, label]) => {
      const note = deptNotesData[deptId]
      const color = DEPT_COLORS[deptId] ? hexToRgb(DEPT_COLORS[deptId]) : PDF_COLORS.accent

      y = checkPageBreak(doc, y, 14)
      // Department label with colored dot
      doc.setFillColor(...color)
      doc.circle(pageMargin + 3, y + 3, 1.5, 'F')
      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...PDF_COLORS.primary)
      doc.text(label, pageMargin + 7, y + 4)
      y += 7

      // Note text (word wrap)
      doc.setFont('Helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...PDF_COLORS.muted)
      const lines = doc.splitTextToSize(note, contentW - 10)
      lines.forEach(line => {
        y = checkPageBreak(doc, y, 5)
        doc.text(line, pageMargin + 7, y + 3)
        y += 4.5
      })
      y += 2
    })
    y += 2
  }

  // ── SECTION 8: WALKIE CHANNELS ──────────────────────────────────
  const walkieData = walkieChannels || DEFAULT_WALKIE
  if (walkieData && Object.keys(walkieData).length > 0) {
    y = drawSectionHeader(doc, y, 'Canais Walkie-Talkie', hexToRgb('#3498DB'))
    const walkieCols = [
      { label: 'Canal', width: 40, bold: true },
      { label: 'Departamento / Funcao', width: contentW - 40 },
    ]
    y = drawTableHeader(doc, y, walkieCols)
    Object.entries(walkieData).forEach(([ch, dept], i) => {
      y = drawTableRow(doc, y, walkieCols, [ch, dept], i)
    })
    y += 4
  }

  // ── FOOTER ──────────────────────────────────────────────────────
  // Add footer to all pages
  const totalPages = doc.internal.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    const pH = doc.internal.pageSize.getHeight()
    // Bottom accent line
    doc.setDrawColor(...PDF_COLORS.divider)
    doc.setLineWidth(0.2)
    doc.line(pageMargin, pH - 12, pageW - pageMargin, pH - 12)
    // Footer text
    doc.setFont('Helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...PDF_COLORS.muted)
    doc.text(`Gerado por FrameFlow — ${new Date().toLocaleString('pt-PT')}`, pageMargin, pH - 8)
    doc.text(`Pagina ${p} de ${totalPages}`, pageW - pageMargin, pH - 8, { align: 'right' })
  }

  // ── SAVE ────────────────────────────────────────────────────────
  const safeName = (projectName || 'Projecto').replace(/[^a-zA-Z0-9_-]/g, '_')
  doc.save(`${safeName}_FolhaServico_Dia${dayNum}.pdf`)
}

// ── Legacy print-based export (fallback) ──────────────────────────
function printCallsheet({ projectName, dayData, dayIndex, callTime, engineDay, sunTimes, dayScenes, parsedScripts, dayLocation, team }) {
  const TURNAROUND = 10
  const dayNum = dayData?.dayNumber || (dayIndex + 1)
  const date = dayData?.date || ''

  let timelineHTML = ''
  ;(engineDay?.blocos || []).forEach((bloco, i, arr) => {
    const prevBloco = i > 0 ? arr[i - 1] : null
    const gapMin = prevBloco ? (bloco.inicio_min || 0) - (prevBloco.fim_min || 0) - (bloco.move_antes || 0) : 0
    if (gapMin > 5 && prevBloco) {
      timelineHTML += `<tr class="gap"><td>${minToTimeStr(prevBloco.fim_min)} -> ${minToTimeStr(bloco.inicio_min - (bloco.move_antes || 0))}</td><td colspan="4">Buffer / Preparacao (${gapMin}min)</td></tr>`
    }
    if (bloco.move_antes > 0) {
      timelineHTML += `<tr class="move"><td>${minToTimeStr((bloco.inicio_min || 0) - bloco.move_antes)} -> ${minToTimeStr(bloco.inicio_min || 0)}</td><td colspan="4">DESLOCACAO para ${bloco.location} (${bloco.move_antes}min)</td></tr>`
    }
    if (bloco.tipo === 'almoco') {
      timelineHTML += `<tr class="lunch"><td>${bloco.hora_inicio} -> ${bloco.hora_fim}</td><td colspan="4"><strong>ALMOCO</strong> (${bloco.duracao}min) — PAUSA OBRIGATORIA</td></tr>`
      return
    }
    timelineHTML += `<tr class="block-header"><td>${bloco.hora_inicio} -> ${bloco.hora_fim}</td><td colspan="3"><strong>${bloco.location}</strong></td><td>${bloco.num_cenas} cenas | ${bloco.duracao}min</td></tr>`
    let cursor = bloco.inicio_min || 0
    ;(bloco.cenas || []).forEach((sc, j) => {
      if (j > 0) cursor += TURNAROUND
      const start = cursor
      cursor += sc.duration || 0
      const [epId, scNum] = (sc.sceneKey || '').split('-')
      const fullScene = parsedScripts?.[epId]?.scenes?.find(s => String(s.sceneNumber) === scNum)
      const desc = (fullScene?.action?.[0] || '').slice(0, 150)
      const chars = (sc.characters || []).join(' | ')
      if (j > 0) {
        timelineHTML += `<tr class="turn"><td></td><td colspan="4" style="font-size:8px;color:#999">Turnaround (${TURNAROUND}min)</td></tr>`
      }
      timelineHTML += `<tr><td>${minToTimeStr(start)}-${minToTimeStr(cursor)}</td><td><strong>${sc.sceneKey}</strong></td><td>${sc.intExt || ''} ${sc.sceneType || ''}</td><td style="max-width:250px">${desc}</td><td>${sc.duration}min</td></tr>`
      if (chars) {
        timelineHTML += `<tr><td></td><td colspan="4" style="font-size:9px;color:#666">Elenco: ${chars}</td></tr>`
      }
    })
  })

  const castMap = new Map()
  ;(engineDay?.blocos || []).forEach(bloco => {
    if (bloco.tipo === 'almoco') return
    let cursor = bloco.inicio_min || 0
    ;(bloco.cenas || []).forEach((sc, j) => {
      if (j > 0) cursor += TURNAROUND
      const end = cursor + (sc.duration || 0)
      ;(sc.characters || []).forEach(c => {
        if (!castMap.has(c)) castMap.set(c, { first: cursor, last: end, scenes: 1 })
        else { const p = castMap.get(c); p.last = Math.max(p.last, end); p.first = Math.min(p.first, cursor); p.scenes++ }
      })
      cursor = end
    })
  })
  let castHTML = ''
  ;[...castMap.entries()].sort((a, b) => a[1].first - b[1].first).forEach(([name, d]) => {
    castHTML += `<tr><td><strong>${name}</strong></td><td>${minToTimeStr(d.first)} -> ${minToTimeStr(d.last)}</td><td>${d.scenes} cena(s)</td></tr>`
  })

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Folha de Servico — Dia ${dayNum}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;color:#222;padding:20px;max-width:800px;margin:0 auto}
h1{font-size:18px;margin-bottom:2px}
h2{font-size:13px;margin:16px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px}
.meta{color:#666;font-size:10px;margin-bottom:12px}
table{width:100%;border-collapse:collapse;margin-bottom:12px}
th,td{padding:4px 6px;text-align:left;border-bottom:1px solid #eee;vertical-align:top}
th{background:#f5f5f5;font-weight:600;font-size:10px;text-transform:uppercase}
.lunch td{background:#fff8e1;font-weight:600}
.move td{background:#fff3e0;font-style:italic;font-size:10px}
.gap td{color:#999;font-size:10px;font-style:italic}
.block-header td{background:#f0f4ff;font-weight:600}
.turn td{border-bottom:none}
@media print{body{padding:10px}@page{margin:15mm}}
</style></head><body>
<h1>${projectName || 'Projecto'} — Folha de Servico</h1>
<p class="meta">Dia ${dayNum} | ${date} | Call: ${engineDay?.callTime || callTime} | Wrap: ${engineDay?.wrapTime || '—'} | ${dayScenes.length} cenas${dayLocation ? ' | ' + dayLocation.name : ''}${sunTimes ? ' | Nascer: ' + sunTimes.sunrise + ' | Por-do-sol: ' + sunTimes.sunset : ''}</p>
<h2>Plano Horario</h2>
<table><thead><tr><th>Hora</th><th>Cena</th><th>Tipo</th><th>Descricao</th><th>Dur.</th></tr></thead><tbody>${timelineHTML}</tbody></table>
<h2>Elenco do Dia</h2>
<table><thead><tr><th>Actor</th><th>Periodo</th><th>Cenas</th></tr></thead><tbody>${castHTML}</tbody></table>
<p style="text-align:center;color:#999;font-size:9px;margin-top:20px">Gerado por FrameFlow | ${new Date().toLocaleString('pt-PT')}</p>
</body></html>`

  const win = window.open('', '_blank', 'width=800,height=1100')
  if (win) {
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 400)
  }
}

// Dept colors
const DEPT_COLORS = Object.fromEntries(
  Object.values(DEPARTMENTS).map(d => [d.id, d.color])
)

const DEPT_LABELS = {
  camara: 'Câmara', luz_electrico: 'Luz', arte: 'Arte / Cenografia',
  guardaroupa: 'Guarda-Roupa', maquilhagem: 'Maquilhagem', som: 'Som',
  realizacao: 'Realização', producao: 'Produção',
}

const DEFAULT_WALKIE = {
  'Canal 1': 'Realização',
  'Canal 2': 'Produção',
  'Canal 3': 'Câmara + Luz',
  'Canal 4': 'Arte + Guarda-roupa',
}

export function CallSheetModule({ embedded = false, initialDayId = '', onBack: onBackProp }) {
  const { 
    auth, shootingDays, sceneAssignments, parsedScripts,
    locations, projectName, team, sceneTakes, departmentItems, departmentConfig,
    cameraReports: allCameraReports, setCameraReports: setStoreCameraReports,
    rsvp, updateRsvp, updateShootingDay, callsheetNotes, updateCallsheetNotes, owmApiKey,
    sceneAnnotations, updateSceneAnnotation,
   } = useStore(useShallow(s => ({ auth: s.auth, shootingDays: s.shootingDays, sceneAssignments: s.sceneAssignments, parsedScripts: s.parsedScripts, locations: s.locations, projectName: s.projectName, team: s.team, sceneTakes: s.sceneTakes, departmentItems: s.departmentItems, departmentConfig: s.departmentConfig, cameraReports: s.cameraReports, setCameraReports: s.setCameraReports, rsvp: s.rsvp, updateRsvp: s.updateRsvp, updateShootingDay: s.updateShootingDay, callsheetNotes: s.callsheetNotes, updateCallsheetNotes: s.updateCallsheetNotes, owmApiKey: s.owmApiKey, sceneAnnotations: s.sceneAnnotations, updateSceneAnnotation: s.updateSceneAnnotation })))
  const shooting = useShootingStore()
  const engineResult = useScheduleEngine()

  const [selectedDay, setSelectedDay] = useState(initialDayId || '')
  const [weather, setWeather] = useState(null)
  const [weatherError, setWeatherError] = useState(false)
  const [sunTimes, setSunTimes] = useState(null)
  const [callTime, setCallTime] = useState('07:30')
  const [expandedDepts, setExpandedDepts] = useState({})
  const deptNotes = (selectedDay && callsheetNotes?.[selectedDay]) || {}
  const [walkieChannels, setWalkieChannels] = useState(DEFAULT_WALKIE)
  const [showExport, setShowExport] = useState(false)
  const [expandedScene, setExpandedScene] = useState(null)
  const [sceneNotes, setSceneNotes] = useState({})
  const [filter, setFilter] = useState('todos')

  // Camera reports from store, keyed by selected day
  const cameraReports = (selectedDay && allCameraReports[selectedDay]) || []
  const setCameraReports = (updater) => {
    const next = typeof updater === 'function' ? updater(cameraReports) : updater
    setStoreCameraReports(selectedDay, next)
  }

  const role = resolveRole(auth.role)
  const canEdit = isAdmin(role) || ['chefe_producao', 'primeiro_ad', 'segundo_ad'].includes(role)

  // Build scenes for selected day
  const dayScenes = useMemo(() => {
    if (!selectedDay) return []
    const scenes = []
    Object.entries(sceneAssignments || {}).forEach(([sceneKey, dayId]) => {
      if (dayId === selectedDay) {
        const [epId, sceneNum] = sceneKey.split('-')
        const ep = parsedScripts?.[epId]
        const scene = ep?.scenes?.find(s => String(s.sceneNumber) === sceneNum)
        scenes.push({
          id: sceneKey,
          sceneNumber: Number(sceneNum),
          episodeId: epId,
          location: scene?.heading?.location || scene?.location || 'Local TBD',
          intExt: scene?.heading?.intExt || scene?.intExt || '',
          dayNight: scene?.heading?.timeOfDay || scene?.dayNight || '',
          characters: scene?.characters || [],
          description: scene?.heading?.full || '',
          pages: scene?.pages || '',
        })
      }
    })
    scenes.sort((a, b) => a.sceneNumber - b.sceneNumber)
    return scenes
  }, [selectedDay, sceneAssignments, parsedScripts])

  // Get location for the day
  const dayLocation = useMemo(() => {
    if (dayScenes.length === 0) return null
    const locName = dayScenes[0]?.location
    return resolveLocation(locations, locName)
      || { name: locName, address: '', lat: 38.7223, lng: -9.1393 } // default Lisboa
  }, [dayScenes, locations])

  // Fetch weather when location available
  useEffect(() => {
    if (!dayLocation?.lat) return
    setWeatherError(false)
    fetchWeather(dayLocation.lat, dayLocation.lng, owmApiKey || '').then(setWeather).catch(err => { console.warn('Weather fetch failed:', err); setWeatherError(true) })
    const day = shootingDays.find(d => d.id === selectedDay)
    fetchSunTimes(dayLocation.lat, dayLocation.lng, day?.date).then(setSunTimes).catch(err => console.warn('Sun times fetch failed:', err))
  }, [dayLocation?.lat, dayLocation?.lng, selectedDay, owmApiKey])

  // Weather alerts
  const weatherAlerts = useMemo(() => {
    return weather ? detectWeatherAlerts(weather, dayScenes) : []
  }, [weather, dayScenes])

  // RSVP (real data from store)
  const dayRsvp = (selectedDay && rsvp?.[selectedDay]) || {}
  const totalTeam = team.length || 1
  const confirmedCount = Object.values(dayRsvp).filter(r => r.status === 'confirmed').length

  // Day info
  const dayData = shootingDays.find(d => d.id === selectedDay)
  const dayIndex = shootingDays.findIndex(d => d.id === selectedDay)
  const nextDay = dayIndex >= 0 ? shootingDays[dayIndex + 1] : null

  // Engine enriched day data (blocos, moves, lunch, wrap, utilization)
  const engineDay = useMemo(() => {
    if (!engineResult?.days || !selectedDay) return null
    return engineResult.days.find(d => d.id === selectedDay) || null
  }, [engineResult?.days, selectedDay])

  // Good takes for export
  const goodTakes = useMemo(() => {
    if (!shooting.takeLog) return []
    const good = shooting.takeLog.filter(t => t.status === 'ok')
    // Merge with camera report data if available
    return good.map(t => {
      const cr = cameraReports.flatMap(r => r.clips || []).find(
        c => c.scene === t.sceneId?.split('-')[1] && String(c.take) === String(t.number)
      )
      return { ...t, scene: t.sceneId?.split('-')[1], take: t.number, note: t.notes, ...(cr || {}) }
    })
  }, [shooting.takeLog, cameraReports])

  // Scene count per day
  const scenesPerDay = useMemo(() => {
    const map = {}
    Object.entries(sceneAssignments || {}).forEach(([, dayId]) => {
      map[dayId] = (map[dayId] || 0) + 1
    })
    return map
  }, [sceneAssignments])

  // Location per day (first location found)
  const locationPerDay = useMemo(() => {
    const map = {}
    Object.entries(sceneAssignments || {}).forEach(([sceneKey, dayId]) => {
      if (map[dayId]) return
      const [epId, sceneNum] = sceneKey.split('-')
      const ep = parsedScripts?.[epId]
      const scene = ep?.scenes?.find(s => String(s.sceneNumber) === sceneNum)
      const loc = scene?.heading?.location || scene?.location
      if (loc) map[dayId] = loc
    })
    return map
  }, [sceneAssignments, parsedScripts])

  const todayStr = new Date().toISOString().slice(0, 10)

  // ── No day selected → setup with day picker cards ──
  if (!selectedDay) {
    return (
      <div className={styles.container}>
        <CallSheetHeader projectName={projectName} />
        <div className={styles.main}>
          <div className={styles.setup}>
            <FileText size={36} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, margin: 0 }}>
              Folha de Serviço
            </h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>
              Seleciona o dia de rodagem
            </p>
          </div>

          {shootingDays.length > 0 ? (
            <div className={styles.dayPickerGrid}>
              {shootingDays.map(d => {
                const isToday = d.date === todayStr
                const isTomorrow = (() => {
                  if (!d.date) return false
                  const t = new Date(); t.setDate(t.getDate() + 1)
                  return d.date === t.toISOString().slice(0, 10)
                })()
                const sceneCount = scenesPerDay[d.id] || 0
                const loc = locationPerDay[d.id]
                const dateLabel = d.date ? (() => {
                  try {
                    return new Date(d.date + 'T00:00:00').toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })
                  } catch { return d.date }
                })() : 'sem data'
                const engineDay = engineResult?.days?.find(ed => ed.id === d.id)
                const util = engineDay?.utilization || 0
                const hasErrors = engineDay?.validation?.severity === 'error'

                return (
                  <motion.button
                    key={d.id}
                    className={`${styles.dayPickerCard} ${isToday ? styles.dayPickerCardToday : ''} ${hasErrors ? styles.dayPickerCardError : ''}`}
                    onClick={() => setSelectedDay(d.id)}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  >
                    {isToday && <span className={styles.dayPickerBadge}>HOJE</span>}
                    {isTomorrow && <span className={styles.dayPickerBadgeTomorrow}>AMANHÃ</span>}
                    <span className={styles.dayPickerNum}>Dia {d.dayNumber || d.id}</span>
                    <span className={styles.dayPickerDate}>{dateLabel}</span>
                    {loc && <span className={styles.dayPickerLoc}>{loc.length > 22 ? loc.slice(0, 20) + '…' : loc}</span>}
                    <div className={styles.dayPickerMeta}>
                      <span>{sceneCount} cena{sceneCount !== 1 ? 's' : ''}</span>
                      {util > 0 && (
                        <span style={{ color: util >= 100 ? 'var(--health-red)' : util >= 88 ? 'var(--health-yellow)' : 'var(--health-green)' }}>
                          {util}%
                        </span>
                      )}
                    </div>
                    {hasErrors && <span className={styles.dayPickerAlert}>⚠</span>}
                  </motion.button>
                )
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                Nenhum dia de rodagem criado. Vai a Produção → Schedule para configurar.
              </p>
              <button
                onClick={() => useStore.getState().navigate('production')}
                style={{
                  padding: '8px 16px', borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-dim)', border: '1px solid var(--accent)',
                  color: 'var(--accent-light)', cursor: 'pointer',
                  fontSize: 'var(--text-sm)', fontWeight: 500, marginTop: 12,
                }}
              >
                Ir para Produção →
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Export handlers ──
  const pdfPayload = {
    projectName, dayData, dayIndex, callTime, engineDay, sunTimes,
    dayScenes, parsedScripts, dayLocation, team, weather,
    deptNotes, walkieChannels, catering: dayData?.catering,
  }
  const handleExport = (type) => {
    const name = projectName || 'Projeto'
    switch (type) {
      case 'pdf':
        exportCallsheetPDF(pdfPayload)
        break
      case 'print':
        printCallsheet(pdfPayload)
        break
      case 'xml':
        downloadFile(generateFCPXML(name, goodTakes), `${name}_AssemblyCut.fcpxml`, 'application/xml')
        break
      case 'edl':
        downloadFile(generateEDL(name, goodTakes), `${name}_AssemblyCut.edl`, 'text/plain')
        break
      case 'ale':
        downloadFile(generateALE(name, goodTakes), `${name}_Takes.ale`, 'text/plain')
        break
      case 'cr':
        cameraReports.forEach((cr, i) => {
          downloadFile(
            generateCameraReportText(cr, name, dayData?.date || ''),
            `${name}_CameraReport_Cam${cr.cameraId || i + 1}.txt`
          )
        })
        break
    }
    setShowExport(false)
  }

  return (
    <div className={styles.container}>
      <CallSheetHeader
        projectName={projectName}
        dayData={dayData}
        dayIndex={dayIndex}
        totalDays={shootingDays.length}
        onExport={() => setShowExport(!showExport)}
        showExport={showExport}
        handleExport={handleExport}
        goodTakes={goodTakes}
        cameraReports={cameraReports}
        onBack={() => { setSelectedDay(''); onBackProp?.() }}
      />
      <div className={styles.main}>
        {/* ── Day Pills (horizontal switcher) ── */}
        {shootingDays.length > 1 && (
          <div className={styles.dayPills}>
            {shootingDays.map(d => (
              <button
                key={d.id}
                className={`${styles.dayPill} ${d.id === selectedDay ? styles.dayPillActive : ''}`}
                onClick={() => setSelectedDay(d.id)}
              >
                Dia {d.dayNumber || d.id}
              </button>
            ))}
          </div>
        )}

        {/* ── FALA DO DIA — hero quote card ── */}
        <HeroQuoteCard
          dayScenes={dayScenes}
          parsedScripts={parsedScripts}
        />

        {/* ── Stats Row ── */}
        <div className={styles.statsRow}>
          <div className={styles.statPill}>
            <span className={styles.statPillLabel}>Total</span>
            <span className={styles.statPillValue}>
              {(engineDay?.blocos?.length || 0) + dayScenes.length}
            </span>
          </div>
          <div className={styles.statPill}>
            <span className={styles.statPillLabel}>Cenas</span>
            <span className={styles.statPillValue}>{dayScenes.length}</span>
          </div>
          <div className={styles.statPill}>
            <span className={styles.statPillLabel}>Teus</span>
            <span className={styles.statPillValue}>{dayScenes.length}</span>
          </div>
          <div className={styles.statPill}>
            <span className={styles.statPillLabel}>Prioridade</span>
            <span className={styles.statPillValue}>{weatherAlerts.length}</span>
          </div>
          <div className={styles.statPill}>
            <span className={styles.statPillLabel}>Weather</span>
            <span className={styles.statPillValue} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {weather?.current?.temp != null ? (
                <>{Math.round(weather.current.temp)}°C</>
              ) : '—'}
            </span>
          </div>
        </div>

        {/* ── Filter Tabs ── */}
        <div className={styles.filterTabs}>
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'cenas', label: 'Cenas' },
            { id: 'calls', label: 'Calls' },
            { id: 'meals', label: 'Meals' },
            { id: 'meu', label: 'So Meu' },
          ].map(tab => (
            <button
              key={tab.id}
              className={`${styles.filterTab} ${filter === tab.id ? styles.filterTabActive : ''}`}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Timeline Event Cards ── */}
        {engineDay?.blocos?.length > 0 && (
          <TimelineCards
            engineDay={engineDay}
            parsedScripts={parsedScripts}
            filter={filter}
            expandedScene={expandedScene}
            setExpandedScene={setExpandedScene}
          />
        )}

        {/* Weather alerts */}
        {weatherAlerts.map((a, i) => (
          <div key={i} className={styles.alert}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            {a.message}
          </div>
        ))}

        {/* Validation / Conflict Detection */}
        <CallSheetValidation
          selectedDay={selectedDay}
          dayScenes={dayScenes}
          sceneAssignments={sceneAssignments}
          parsedScripts={parsedScripts}
          team={team}
          departmentItems={departmentItems}
          departmentConfig={departmentConfig}
          locations={locations}
          weather={weather}
        />

        {/* Location + Weather */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}><MapPin size={14} /> Local</h3>
          <p className={styles.locationName}>{dayLocation?.name}</p>
          {dayLocation?.address && <p className={styles.locationAddress}>{dayLocation.address}</p>}
          <div className={styles.locationMeta}>
            {dayLocation?.parkingNotes && <span>🅿️ {dayLocation.parkingNotes}</span>}
            {dayLocation?.accessNotes && <span>🚪 {dayLocation.accessNotes}</span>}
            {dayLocation?.walkiChannel && <span><Radio size={11} /> {dayLocation.walkiChannel}</span>}
            {dayLocation?.lat && (
              <a
                className={styles.mapBtn}
                href={`https://www.google.com/maps?q=${dayLocation.lat},${dayLocation.lng}`}
                target="_blank"
                rel="noopener"
              >
                <ExternalLink size={11} /> Ver no mapa
              </a>
            )}
          </div>
        </div>

        {/* Weather */}
        {weather && (
          <div className={styles.card}>
            <h3 className={styles.cardTitle}><Cloud size={14} /> Meteorologia</h3>
            <div className={styles.weatherMain}>
              <span style={{ fontSize: 28 }}>{weatherIcon(weather.current?.icon)}</span>
              <span className={styles.weatherTemp}>{weather.current?.temp}°C</span>
              <span className={styles.weatherDesc}>{weather.current?.description}</span>
            </div>
            <div className={styles.weatherDetails}>
              <span><Wind size={12} /> {weather.current?.wind?.speed} km/h</span>
              <span><Droplets size={12} /> {weather.current?.humidity}%</span>
              {sunTimes && (
                <>
                  <span><Sunrise size={12} /> {sunTimes.sunrise}</span>
                  <span><Sunset size={12} /> {sunTimes.sunset}</span>
                  <span>🌅 Golden: {sunTimes.goldenHour}</span>
                </>
              )}
            </div>
            {weather.hourly?.length > 0 && (
              <div className={styles.weatherHourly}>
                {weather.hourly.slice(0, 6).map((h, i) => (
                  <div key={i} className={styles.weatherHour}>
                    <span>{h.time}</span>
                    <span>{weatherIcon(h.icon)}</span>
                    <span className={styles.weatherHourTemp}>{h.temp}°</span>
                    {h.pop > 20 && <span className={styles.weatherHourRain}>{h.pop}%</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {!weather && weatherError && (
          <div className={styles.card}>
            <h3 className={styles.cardTitle}><Cloud size={14} /> Meteorologia</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 8 }}>Meteo indisponível</p>
            <button
              onClick={() => {
                if (!dayLocation?.lat) return
                setWeatherError(false)
                fetchWeather(dayLocation.lat, dayLocation.lng, owmApiKey || '').then(setWeather).catch(() => setWeatherError(true))
              }}
              style={{
                padding: '6px 12px', borderRadius: 'var(--radius-md)',
                background: 'var(--accent-dim)', border: '1px solid var(--accent)',
                color: 'var(--accent-light)', cursor: 'pointer',
                fontSize: 'var(--text-sm)', fontWeight: 500,
              }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Sunlight Calculator */}
        {dayLocation?.lat && (
          <div className={styles.card}>
            <SunlightCalculator
              latitude={dayLocation.lat}
              longitude={dayLocation.lng}
              date={dayData?.date}
              location={dayLocation.name || dayLocation.address || ''}
            />
          </div>
        )}

        {/* Call time */}
        <div className={styles.card} style={{ textAlign: 'center' }}>
          <h3 className={styles.cardTitle} style={{ justifyContent: 'center' }}>
            <Clock size={14} /> Call Geral
          </h3>
          {canEdit ? (
            <input
              type="time"
              className={styles.callInput}
              value={callTime}
              onChange={e => setCallTime(e.target.value)}
            />
          ) : (
            <p className={styles.callTime}>{callTime}</p>
          )}
        </div>

        {/* ── Catering / Almoço (resumo — gestão completa no módulo Refeições) ── */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}><Coffee size={14} /> Catering / Almoço</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(dayData?.catering?.time || dayData?.catering?.location) ? (
              <>
                {dayData.catering.time && (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                    <Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    {dayData.catering.time}
                  </p>
                )}
                {dayData.catering.location && (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                    <MapPin size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    {dayData.catering.location}
                  </p>
                )}
                {dayData.catering.provider && (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>
                    {dayData.catering.provider}
                  </p>
                )}
              </>
            ) : (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>
                Sem informação de catering definida.
              </p>
            )}
            <button
              onClick={() => useStore.getState().navigate('meals')}
              style={{
                marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(249,115,22,0.08)', color: 'var(--mod-meals, #F97316)',
                border: '1px solid rgba(249,115,22,0.2)', borderRadius: 'var(--radius-sm)',
                padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                width: 'fit-content',
              }}
            >
              <Utensils size={13} /> Gerir Refeições &rarr;
            </button>
          </div>
        </div>

        {/* ── Estacionamento ── */}
        {canEdit && (
          <ParkingEditor
            dayData={dayData}
            canEdit={canEdit}
            onUpdate={(patch) => updateShootingDay(selectedDay, patch)}
            team={team}
          />
        )}

        {/* ── Plano Horário (from engine) ── */}
        {engineDay?.blocos?.length > 0 && (
          <div className={styles.card}>
            <h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center' }}>
              <Clock size={14} /> Plano Horário
              <button
                style={{ marginLeft: 'auto', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-sm)', padding: '3px 10px', fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                onClick={() => exportCallsheetPDF({
                  projectName, dayData, dayIndex, callTime, engineDay, sunTimes,
                  dayScenes, parsedScripts, dayLocation, team, weather,
                  deptNotes, walkieChannels, catering: dayData?.catering,
                })}
              >
                <Download size={10} /> PDF
              </button>
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 12, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              <span>Call: <strong style={{ color: 'var(--text-primary)' }}>{engineDay.callTime || callTime}</strong></span>
              <span>Wrap: <strong style={{ color: 'var(--text-primary)' }}>{engineDay.wrapTime || '—'}</strong></span>
              <span>Utilização: <strong style={{
                color: (engineDay.utilization || 0) >= 100 ? 'var(--health-red)' : (engineDay.utilization || 0) >= 88 ? 'var(--health-yellow)' : 'var(--health-green)',
              }}>{engineDay.utilization || 0}%</strong></span>
              <span>Buffer: <strong>{(engineDay.windowMin || 600) - (engineDay.totalMin || 0)}min</strong></span>
              {sunTimes && <span><Sunrise size={10} /> {sunTimes.sunrise} · <Sunset size={10} /> {sunTimes.sunset}</span>}
              {sunTimes?.goldenHour && <span style={{ color: 'var(--health-yellow)' }}>Golden: {sunTimes.goldenHour}</span>}
            </div>
            {engineDay.blocos.map((bloco, i, arr) => {
              // Detect gap between previous block end and this block start
              const prevBloco = i > 0 ? arr[i - 1] : null
              const gapMin = prevBloco ? (bloco.inicio_min || 0) - (prevBloco.fim_min || 0) - (bloco.move_antes || 0) : 0

              if (bloco.tipo === 'almoco') {
                return (
                  <div key={`b-${i}`}>
                    {gapMin > 5 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', margin: '2px 0', fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', borderLeft: '2px dashed rgba(255,255,255,0.06)' }}>
                        {minToTimeStr(prevBloco.fim_min)} → {minToTimeStr(bloco.inicio_min)} · Preparação / Buffer ({gapMin}min)
                      </div>
                    )}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 12px', margin: '6px 0',
                      background: 'rgba(251,191,36,0.06)', border: '1px dashed rgba(251,191,36,0.25)',
                      borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)',
                    }}>
                      <Coffee size={14} color="var(--health-yellow)" />
                      <span style={{ fontFamily: "'Courier New', monospace", fontWeight: 700 }}>{bloco.hora_inicio} → {bloco.hora_fim}</span>
                      <span>ALMOÇO ({bloco.duracao}min)</span>
                      <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, color: 'var(--health-yellow)', letterSpacing: '0.05em' }}>PAUSA OBRIGATÓRIA</span>
                    </div>
                  </div>
                )
              }

              // Compute per-scene start times within the block
              // Add turnaround time (camera repos, actor prep) between scenes: 10min same setup, 15min different
              const TURNAROUND_MIN = 10
              let sceneCursor = bloco.inicio_min || 0
              const scenesWithTimes = (bloco.cenas || []).map((sc, idx) => {
                if (idx > 0) sceneCursor += TURNAROUND_MIN
                const start = sceneCursor
                sceneCursor += sc.duration || 0
                // Find the full scene description from parsedScripts
                const [epId, scNum] = (sc.sceneKey || '').split('-')
                const fullScene = parsedScripts?.[epId]?.scenes?.find(s => String(s.sceneNumber) === scNum)
                const actionText = fullScene?.action?.[0] || fullScene?.heading?.full || ''
                return { ...sc, startMin: start, endMin: sceneCursor, actionText, hasTurnaround: idx > 0 }
              })

              // Lighting change detection (INT→EXT or EXT→INT within same block)
              const lightingChanges = []
              for (let j = 1; j < scenesWithTimes.length; j++) {
                const prev = scenesWithTimes[j - 1]
                const curr = scenesWithTimes[j]
                if (prev.intExt !== curr.intExt) {
                  lightingChanges.push(j)
                }
              }

              return (
                <div key={`b-${i}`}>
                  {/* Gap indicator */}
                  {gapMin > 5 && prevBloco && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', margin: '2px 0', fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', borderLeft: '2px dashed rgba(255,255,255,0.06)' }}>
                      {minToTimeStr(prevBloco.fim_min)} → {minToTimeStr(bloco.inicio_min - (bloco.move_antes || 0))} · Preparação / Buffer ({gapMin}min)
                    </div>
                  )}
                  {/* Move time */}
                  {bloco.move_antes > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', margin: '2px 0', fontSize: 10, color: 'var(--health-yellow)', background: 'rgba(251,191,36,0.04)', borderLeft: '2px solid rgba(251,191,36,0.3)', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0' }}>
                      <MapPin size={10} />
                      <span style={{ fontFamily: "'Courier New', monospace", fontWeight: 600 }}>
                        {minToTimeStr((bloco.inicio_min || 0) - bloco.move_antes)} → {minToTimeStr(bloco.inicio_min || 0)}
                      </span>
                      DESLOCAÇÃO para {bloco.location} ({bloco.move_antes}min)
                    </div>
                  )}
                  <div style={{
                    padding: '10px 12px', margin: '4px 0',
                    borderLeft: `3px solid ${bloco.color || 'var(--mod-production)'}`,
                    background: 'var(--bg-elevated)', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                  }}>
                    {/* Block header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--mod-production)' }}>
                        {bloco.hora_inicio} → {bloco.hora_fim}
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>{bloco.location}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{bloco.num_cenas} cena{bloco.num_cenas !== 1 ? 's' : ''} · {bloco.duracao}min</span>
                      {bloco.tem_exterior && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(251,191,36,0.12)', color: 'var(--health-yellow)', fontWeight: 700 }}>EXT</span>}
                      {bloco.episodios?.length > 1 && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(94,139,239,0.12)', color: 'var(--accent-light)', fontWeight: 700 }}>{bloco.episodios.length} eps</span>}
                    </div>
                    {/* Scene rows — DESDOBRADO style */}
                    {scenesWithTimes.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {scenesWithTimes.map((sc, j) => {
                          const startTime = minToTimeStr(sc.startMin)
                          const endTime = minToTimeStr(sc.endMin)
                          const hasLightChange = lightingChanges.includes(j)
                          return (
                            <div key={sc.sceneKey}>
                              {/* Turnaround between scenes */}
                              {sc.hasTurnaround && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 8px', margin: '1px 0', fontSize: 9, color: 'var(--text-muted)', fontStyle: 'italic', opacity: 0.7 }}>
                                  ↻ Turnaround ({TURNAROUND_MIN}min — reposição câmara, preparação actores)
                                </div>
                              )}
                              {hasLightChange && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', margin: '4px 0 2px', fontSize: 9, color: 'var(--health-yellow)', fontWeight: 700, borderTop: '1px dashed rgba(251,191,36,0.25)', borderBottom: '1px dashed rgba(251,191,36,0.25)' }}>
                                  ⚡ Mudança de iluminação ({scenesWithTimes[j - 1].intExt} → {sc.intExt})
                                </div>
                              )}
                              {/* Scene header row */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', padding: '5px 8px', borderRadius: 3, background: j % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <span style={{ fontFamily: "'Courier New', monospace", fontWeight: 600, minWidth: 90, color: 'var(--text-muted)', fontSize: 10 }}>
                                  {startTime}→{endTime}
                                </span>
                                <span style={{ fontWeight: 700, minWidth: 70, color: bloco.color || 'var(--mod-production)' }}>{sc.sceneKey}</span>
                                <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)' }}>{sc.epId}</span>
                                <span style={{ fontSize: 9, padding: '0 4px', borderRadius: 2, background: sc.intExt === 'EXT' ? 'rgba(251,191,36,0.1)' : 'rgba(100,100,200,0.1)', color: sc.intExt === 'EXT' ? 'var(--health-yellow)' : 'var(--text-muted)', fontWeight: 600 }}>
                                  {sc.intExt}{sc.dayNight ? ` ${sc.dayNight}` : ''}
                                </span>
                                {sc.sceneType && (
                                  <span style={{ fontSize: 9, padding: '0 5px', borderRadius: 2, background: 'rgba(160,46,111,0.1)', color: '#A02E6F', fontWeight: 600 }}>{sc.sceneType}</span>
                                )}
                                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }}>{sc.duration}min</span>
                              </div>
                              {/* Scene description */}
                              {sc.actionText && (
                                <div style={{ padding: '2px 8px 2px 100px', fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.4, maxHeight: 32, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {sc.actionText.length > 180 ? sc.actionText.slice(0, 180) + '…' : sc.actionText}
                                </div>
                              )}
                              {/* Characters for this scene */}
                              {(sc.characters || []).length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, padding: '2px 8px 4px 100px' }}>
                                  {sc.characters.map(c => (
                                    <span key={c} style={{ fontSize: 9, padding: '0 5px', borderRadius: 3, background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.06)' }}>{c}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Elenco do dia (cast call) ── */}
        {engineDay && (() => {
          // Build cast list with first/last scene times
          const castMap = new Map()
          ;(engineDay.blocos || []).forEach(bloco => {
            if (bloco.tipo === 'almoco') return
            let cursor = bloco.inicio_min || 0
            ;(bloco.cenas || []).forEach(sc => {
              const end = cursor + (sc.duration || 0)
              ;(sc.characters || []).forEach(c => {
                if (!castMap.has(c)) {
                  castMap.set(c, { firstMin: cursor, lastMin: end, scenes: 1 })
                } else {
                  const prev = castMap.get(c)
                  prev.lastMin = Math.max(prev.lastMin, end)
                  prev.firstMin = Math.min(prev.firstMin, cursor)
                  prev.scenes += 1
                }
              })
              cursor = end
            })
          })
          if (castMap.size === 0) return null
          const castList = [...castMap.entries()]
            .map(([name, d]) => ({ name, ...d }))
            .sort((a, b) => a.firstMin - b.firstMin)

          return (
            <div className={styles.card}>
              <h3 className={styles.cardTitle}><Users size={14} /> Elenco do Dia ({castList.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {castList.map(actor => (
                  <div key={actor.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, padding: '3px 0' }}>
                    <span style={{ fontWeight: 600, minWidth: 120, color: 'var(--text-primary)' }}>{actor.name}</span>
                    <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: 'var(--text-muted)' }}>
                      {minToTimeStr(actor.firstMin)} → {minToTimeStr(actor.lastMin)}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{actor.scenes} cena{actor.scenes !== 1 ? 's' : ''}</span>
                    {actor.lastMin < (engineDay.blocos?.[engineDay.blocos.length - 1]?.fim_min || 999) && (
                      <span style={{ fontSize: 9, color: 'var(--health-green)', fontWeight: 600, marginLeft: 'auto' }}>
                        Dispensado {minToTimeStr(actor.lastMin)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Scenes */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}><FileText size={14} /> Cenas do Dia ({dayScenes.length})</h3>
          {dayScenes.map(scene => {
            const hasRainAlert = weatherAlerts.some(a =>
              a.type === 'rain_ext' && a.scenes?.includes(scene.sceneNumber)
            )
            const isExpanded = expandedScene === scene.id
            return (
              <div key={scene.id}>
                <div
                  className={`${styles.sceneRow} ${styles.sceneRowClickable} ${isExpanded ? styles.sceneRowActive : ''}`}
                  onClick={() => setExpandedScene(isExpanded ? null : scene.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className={styles.sceneNum}>Sc.{scene.sceneNumber}</span>
                  <div className={styles.sceneInfo}>
                    <span className={styles.sceneLocation}>{scene.location}</span>
                    <span className={styles.sceneMeta}>
                      {scene.intExt && <span>{scene.intExt}</span>}
                      {scene.dayNight && <span>{scene.dayNight}</span>}
                      {scene.episodeId && <span>{scene.episodeId}</span>}
                      {scene.pages && <span>{scene.pages} pgs</span>}
                    </span>
                    {scene.characters?.length > 0 && (
                      <div className={styles.sceneChars}>
                        {scene.characters.slice(0, 5).map(c => (
                          <span key={c} className={styles.charBadge}>{c}</span>
                        ))}
                        {scene.characters.length > 5 && <span className={styles.charBadge}>+{scene.characters.length - 5}</span>}
                      </div>
                    )}
                  </div>
                  {hasRainAlert && <span className={styles.sceneAlert}>⚠️ Chuva</span>}
                  <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
                </div>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      className={styles.sceneExpanded}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {/* Scene description/action */}
                      {scene.description && (
                        <div className={styles.sceneAction}>
                          <span className={styles.sceneActionLabel}>Cabeçalho</span>
                          {scene.description}
                        </div>
                      )}

                      {/* Full action text from parsed script */}
                      {(() => {
                        const ep = parsedScripts?.[scene.episodeId]
                        const fullScene = ep?.scenes?.find(s => String(s.sceneNumber) === String(scene.sceneNumber))
                        const actionText = fullScene?.action || fullScene?.content || ''
                        return actionText ? (
                          <div className={styles.sceneAction}>
                            <span className={styles.sceneActionLabel}>Guião</span>
                            <div className={styles.sceneActionText}>{actionText}</div>
                          </div>
                        ) : null
                      })()}

                      {/* Takes */}
                      {(() => {
                        const takes = sceneTakes?.[scene.id] || []
                        return takes.length > 0 ? (
                          <div className={styles.sceneTakes}>
                            <span className={styles.sceneActionLabel}>Takes ({takes.length})</span>
                            {takes.map(t => (
                              <div key={t.id} className={styles.takeRow}>
                                <span className={styles.takeNum}>T{t.number || takes.indexOf(t) + 1}</span>
                                <span className={`${styles.takeStatus} ${t.status === 'ok' ? styles.takeOk : t.status === 'nok' ? styles.takeNok : styles.takeMaybe}`}>
                                  {(t.status || 'pending').toUpperCase()}
                                </span>
                                {t.notes && <span className={styles.takeNotes}>{t.notes}</span>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className={styles.sceneTakes}>
                            <span className={styles.sceneActionLabel}>Takes</span>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Sem takes registados</span>
                          </div>
                        )
                      })()}

                      {/* ── Scene Annotations (Script Supervisor) ── */}
                      <SceneAngleAnnotations
                        sceneKey={scene.id}
                        annotations={sceneAnnotations?.[scene.id]}
                        onUpdate={updateSceneAnnotation}
                        canEdit={canEdit}
                      />

                      {/* All characters */}
                      {scene.characters?.length > 0 && (
                        <div className={styles.sceneSection}>
                          <span className={styles.sceneActionLabel}>Elenco ({scene.characters.length})</span>
                          <div className={styles.sceneCharsFull}>
                            {scene.characters.map(c => (
                              <span key={c} className={styles.charBadgeFull}>{c}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Department items for this scene */}
                      {(() => {
                        const deptItems = (departmentItems || []).filter(item =>
                          item.scenes?.includes(scene.id) || item.scenes?.includes(scene.sceneNumber?.toString())
                        )
                        return deptItems.length > 0 ? (
                          <div className={styles.sceneSection}>
                            <span className={styles.sceneActionLabel}>Departamentos ({deptItems.length})</span>
                            {deptItems.map(item => (
                              <div key={item.id} className={styles.deptItemRow}>
                                <span className={styles.deptItemDept}>{item.department || item.dept}</span>
                                <span className={styles.deptItemName}>{item.name || item.description}</span>
                                {item.status && <span className={styles.deptItemStatus}>{item.status}</span>}
                              </div>
                            ))}
                          </div>
                        ) : null
                      })()}

                      {/* Scene notes (editable) */}
                      <div className={styles.sceneSection}>
                        <span className={styles.sceneActionLabel}>Notas</span>
                        {canEdit ? (
                          <textarea
                            className={styles.sceneNoteInput}
                            placeholder="Adicionar notas para esta cena..."
                            value={sceneNotes[scene.id] || ''}
                            onChange={e => setSceneNotes(prev => ({ ...prev, [scene.id]: e.target.value }))}
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <div className={styles.sceneNoteText}>
                            {sceneNotes[scene.id] || 'Sem notas'}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>

        {/* Department notes */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}><Users size={14} /> Notas por Departamento</h3>
          {Object.entries(DEPT_LABELS).map(([deptId, label]) => (
            <DeptNoteSection
              key={deptId}
              deptId={deptId}
              label={label}
              color={DEPT_COLORS[deptId] || 'var(--text-muted)'}
              expanded={expandedDepts[deptId]}
              onToggle={() => setExpandedDepts(p => ({ ...p, [deptId]: !p[deptId] }))}
              notes={deptNotes[deptId] || ''}
              onNotesChange={canEdit ? (v) => updateCallsheetNotes(selectedDay, deptId, v) : null}
              canEdit={canEdit}
            />
          ))}
        </div>

        {/* Walkie Channels */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}><Radio size={14} /> Canais Walkie-Talkie</h3>
          <div className={styles.walkieGrid}>
            {Object.entries(walkieChannels).map(([ch, dept]) => (
              <div key={ch} className={styles.walkieItem}>
                <span className={styles.walkieChannel}>{ch}</span>
                <span className={styles.walkieLabel}>{dept}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hospital */}
        {dayLocation?.nearestHospital ? (
          <div className={styles.card}>
            <h3 className={styles.cardTitle}><Heart size={14} /> Hospital Mais Próximo</h3>
            <div className={styles.hospitalCard}>
              <Heart size={16} style={{ color: 'var(--health-red)', flexShrink: 0 }} />
              <div>
                <p className={styles.hospitalName}>{dayLocation.nearestHospital.name}</p>
                <p className={styles.hospitalInfo}>
                  {dayLocation.nearestHospital.distance} · {dayLocation.nearestHospital.phone}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.card}>
            <h3 className={styles.cardTitle}><Heart size={14} /> Hospital Mais Próximo</h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
              Adiciona coordenadas ao local para gerar automaticamente
            </p>
          </div>
        )}

        {/* RSVP */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>✓ Confirmações de Recepção</h3>
          <div className={styles.rsvpRow}>
            <div className={styles.rsvpBar}>
              <div className={styles.rsvpFill} style={{ width: `${totalTeam > 0 ? (confirmedCount / totalTeam) * 100 : 0}%` }} />
            </div>
            <span className={styles.rsvpCount}>{confirmedCount}/{totalTeam}</span>
          </div>
          {team.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 200, overflowY: 'auto' }}>
              {team.map(m => {
                const st = dayRsvp[m.id]?.status || 'pending'
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '3px 0' }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: st === 'confirmed' ? 'var(--health-green)' : st === 'declined' ? 'var(--health-red)' : 'var(--text-muted)',
                    }} />
                    <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{m.name}</span>
                    {canEdit && (
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button
                          onClick={() => updateRsvp(selectedDay, m.id, { status: 'confirmed' })}
                          style={{
                            padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, border: 'none', cursor: 'pointer',
                            background: st === 'confirmed' ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.05)',
                            color: st === 'confirmed' ? '#34D399' : 'var(--text-muted)',
                          }}
                        >✓</button>
                        <button
                          onClick={() => updateRsvp(selectedDay, m.id, { status: 'declined' })}
                          style={{
                            padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, border: 'none', cursor: 'pointer',
                            background: st === 'declined' ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.05)',
                            color: st === 'declined' ? '#F87171' : 'var(--text-muted)',
                          }}
                        >✗</button>
                        {st !== 'pending' && (
                          <button
                            onClick={() => updateRsvp(selectedDay, m.id, { status: 'pending' })}
                            style={{
                              padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, border: 'none', cursor: 'pointer',
                              background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)',
                            }}
                          >↺</button>
                        )}
                      </div>
                    )}
                    {!canEdit && (
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {st === 'confirmed' ? 'Confirmado' : st === 'declined' ? 'Recusou' : 'Pendente'}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Camera Reports */}
        <CameraReportSection
          cameraReports={cameraReports}
          setCameraReports={setCameraReports}
          shooting={shooting}
          canEdit={canEdit || role === 'dir_fotografia' || role === 'segundo_ac'}
        />

        {/* Next day preview + WhatsApp */}
        {nextDay && (
          <NextDayCard
            nextDay={nextDay}
            dayIndex={dayIndex}
            sceneAssignments={sceneAssignments}
            parsedScripts={parsedScripts}
            locations={locations}
            team={team}
            projectName={projectName}
            weather={weather}
            engineResult={engineResult}
            canEdit={canEdit}
          />
        )}
      </div>
    </div>
  )
}

// ── Validation / Conflict Detection ──────────────────────────────
function CallSheetValidation({ selectedDay, dayScenes, sceneAssignments, parsedScripts, team, departmentItems, departmentConfig, locations, weather }) {
  const [expanded, setExpanded] = useState(false)

  const warnings = useMemo(() => {
    if (!selectedDay || dayScenes.length === 0) return []
    const result = []

    // ── 1. Actor conflicts: same character in scenes at different locations ──
    const charLocations = {}
    dayScenes.forEach(scene => {
      const loc = scene.location || 'Desconhecido'
      ;(scene.characters || []).forEach(charName => {
        if (!charLocations[charName]) charLocations[charName] = new Set()
        charLocations[charName].add(loc)
      })
    })
    Object.entries(charLocations).forEach(([charName, locs]) => {
      if (locs.size > 1) {
        const locList = [...locs].join(' e ')
        result.push({
          type: 'actor-conflict',
          message: `${charName} aparece em cenas de locais diferentes: ${locList}`,
        })
      }
    })

    // ── 2. Incomplete crew by department ──
    const daySceneKeys = new Set(dayScenes.map(s => s.id))
    const deptsWithItems = new Set()
    ;(departmentItems || []).forEach(item => {
      const hasSceneToday = (item.scenes || []).some(sk => daySceneKeys.has(sk))
      if (hasSceneToday && item.department) {
        deptsWithItems.add(item.department)
      }
    })
    deptsWithItems.forEach(deptId => {
      const deptConf = (departmentConfig || []).find(d => d.id === deptId)
      const deptLabel = deptConf?.label || deptId
      const hodMembers = team.filter(m => {
        const memberRole = (m.role || '').toLowerCase()
        const memberGroup = (m.group || '').toLowerCase()
        const isHOD = memberRole.includes('chefe') || memberRole.includes('director') ||
                      memberRole.includes('hod') || memberRole.includes('responsável') ||
                      memberRole.includes('supervisor')
        const matchesDept = memberGroup.includes(deptId) ||
                            memberRole.toLowerCase().includes(deptId) ||
                            (deptConf?.label && memberGroup.toLowerCase().includes(deptConf.label.toLowerCase()))
        return isHOD && matchesDept
      })
      const hodConfirmed = hodMembers.some(m =>
        (m.confirmedDays || []).includes(selectedDay)
      )
      if (hodMembers.length === 0 || !hodConfirmed) {
        result.push({
          type: 'crew-incomplete',
          message: `Departamento ${deptLabel} tem items para hoje mas sem HOD confirmado`,
        })
      }
    })

    // ── 3. Exterior scenes without weather check ──
    const extScenes = dayScenes.filter(s => {
      const ie = (s.intExt || '').toUpperCase()
      return ie.includes('EXT')
    })
    if (extScenes.length > 0 && !weather) {
      const sceneList = extScenes.map(s => `Sc.${s.sceneNumber}`).join(', ')
      result.push({
        type: 'ext-no-weather',
        message: `Cenas exteriores sem verificação meteorológica: ${sceneList}`,
      })
    }

    return result
  }, [selectedDay, dayScenes, sceneAssignments, parsedScripts, team, departmentItems, departmentConfig, locations, weather])

  const count = warnings.length
  const isAllClear = count === 0

  return (
    <div className={`${styles.validationBar} ${isAllClear ? styles.validationClear : styles.validationWarn}`}>
      <button
        className={styles.validationToggle}
        onClick={() => !isAllClear && setExpanded(e => !e)}
        style={{ cursor: isAllClear ? 'default' : 'pointer' }}
      >
        {isAllClear ? (
          <>
            <CheckCircle size={15} style={{ color: 'var(--health-green)', flexShrink: 0 }} />
            <span className={styles.validationLabel}>Sem conflictos detectados</span>
          </>
        ) : (
          <>
            <AlertTriangle size={15} style={{ color: 'var(--status-warn)', flexShrink: 0 }} />
            <span className={styles.validationLabel}>{count} alerta{count !== 1 ? 's' : ''}</span>
            <span className={styles.validationBadge}>{count}</span>
            <ChevronDown
              size={14}
              style={{
                color: 'var(--text-muted)',
                transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s',
                marginLeft: 'auto',
              }}
            />
          </>
        )}
      </button>
      <AnimatePresence>
        {expanded && !isAllClear && (
          <motion.div
            className={styles.validationDetails}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {warnings.map((w, i) => (
              <div key={i} className={styles.validationItem}>
                <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{w.message}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Header ───────────────────────────────────────────────────────
function CallSheetHeader({ projectName, dayData, dayIndex, totalDays, onExport, showExport, handleExport, goodTakes, cameraReports, onBack }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        {onBack && (
          <button className={styles.backBtn} onClick={onBack}>
            <ArrowLeft size={16} /> Voltar
          </button>
        )}
        <FileText size={20} />
        <div>
          <h1 className={styles.headerTitle}>Folha de Serviço</h1>
          {dayData && (
            <div className={styles.headerMeta}>
              <span>{projectName}</span>
              <span>Dia {dayIndex + 1} de {totalDays}</span>
              {dayData.date && <span>{dayData.date}</span>}
            </div>
          )}
        </div>
      </div>
      {handleExport && (
        <div className={styles.headerActions} style={{ position: 'relative' }}>
          <button className={styles.headerBtn} onClick={onExport}>
            <Download size={13} /> Exportar
          </button>
          <AnimatePresence>
            {showExport && (
              <motion.div
                className={styles.exportMenu}
                data-glass
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
              >
                <p style={{ fontSize: 9, color: 'var(--text-muted)', padding: '6px 12px 2px', margin: 0, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Folha de Servico
                </p>
                <button className={styles.exportItem} onClick={() => handleExport('pdf')}>
                  <Download size={13} />
                  <div>
                    Exportar PDF <span className={styles.exportItemSub}>Documento A4 completo</span>
                  </div>
                </button>
                <button className={styles.exportItem} onClick={() => handleExport('print')}>
                  <Printer size={13} />
                  <div>
                    Imprimir <span className={styles.exportItemSub}>Via browser (print dialog)</span>
                  </div>
                </button>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 12px' }} />
                <p style={{ fontSize: 9, color: 'var(--text-muted)', padding: '4px 12px 2px', margin: 0, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Editorial
                </p>
                <button className={styles.exportItem} onClick={() => handleExport('xml')}>
                  <Download size={13} />
                  <div>
                    FCPXML <span className={styles.exportItemSub}>Premiere / Resolve</span>
                  </div>
                </button>
                <button className={styles.exportItem} onClick={() => handleExport('edl')}>
                  <Download size={13} />
                  <div>
                    EDL CMX3600 <span className={styles.exportItemSub}>Legacy / Broadcaster</span>
                  </div>
                </button>
                <button className={styles.exportItem} onClick={() => handleExport('ale')}>
                  <Download size={13} />
                  <div>
                    ALE <span className={styles.exportItemSub}>Avid Media Composer</span>
                  </div>
                </button>
                {cameraReports?.length > 0 && (
                  <button className={styles.exportItem} onClick={() => handleExport('cr')}>
                    <Camera size={13} />
                    <div>
                      Camera Reports <span className={styles.exportItemSub}>Relatório por câmara</span>
                    </div>
                  </button>
                )}
                <p style={{ fontSize: 10, color: 'var(--text-muted)', padding: '4px 12px', margin: 0 }}>
                  {goodTakes?.length || 0} good takes para exportar
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </header>
  )
}

// ── Department Notes ─────────────────────────────────────────────
function DeptNoteSection({ deptId, label, color, expanded, onToggle, notes, onNotesChange, canEdit }) {
  return (
    <div className={styles.deptSection}>
      <button className={styles.deptHeader} onClick={onToggle}>
        <span className={styles.deptDot} style={{ background: color }} />
        <span className={styles.deptName}>{label}</span>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            className={styles.deptContent}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {notes && <div className={styles.deptNote}>{notes}</div>}
            {canEdit && onNotesChange && (
              <textarea
                className={styles.deptInput}
                placeholder={`Notas de ${label} para o dia…`}
                value={notes}
                onChange={e => onNotesChange(e.target.value)}
              />
            )}
            {!canEdit && !notes && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Sem notas
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Camera Reports ───────────────────────────────────────────────
function CameraReportSection({ cameraReports, setCameraReports, shooting, canEdit }) {
  const [showForm, setShowForm] = useState(false)
  const [newReport, setNewReport] = useState({
    cameraId: 'A', camera: '', cardNumber: 1,
    storageMedia: '', backupStatus: 'pending', backupDestination: '',
  })

  const addReport = () => {
    // Auto-populate clips from shooting takes
    const clips = (shooting.takeLog || []).map(t => ({
      scene: t.sceneId?.split('-')[1] || '',
      take: t.number,
      status: t.status,
      note: t.notes || '',
      lens: '', iso: '', aperture: '', fps: 25, resolution: '4K', format: '', filename: '',
    }))

    setCameraReports(prev => [...prev, {
      ...newReport,
      id: Date.now().toString(36),
      clips,
    }])
    setShowForm(false)
  }

  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>
        <Camera size={14} /> Camera Reports
        {canEdit && (
          <button
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              color: 'var(--accent-light)', cursor: 'pointer', display: 'flex',
            }}
            onClick={() => setShowForm(!showForm)}
          >
            <Plus size={14} />
          </button>
        )}
      </h3>

      <AnimatePresence>
        {showForm && (
          <motion.div
            className={styles.crForm}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className={styles.crRow}>
              <select className={styles.crInput} value={newReport.cameraId}
                onChange={e => setNewReport(p => ({ ...p, cameraId: e.target.value }))}>
                <option value="A">Câmara A</option>
                <option value="B">Câmara B</option>
                <option value="C">Câmara C</option>
              </select>
              <input className={styles.crInput} placeholder="Modelo (ex: Sony FX6)"
                value={newReport.camera} onChange={e => setNewReport(p => ({ ...p, camera: e.target.value }))} />
            </div>
            <div className={styles.crRow}>
              <input className={styles.crInput} placeholder="Cartão nº" type="number"
                value={newReport.cardNumber} onChange={e => setNewReport(p => ({ ...p, cardNumber: Number(e.target.value) }))} />
              <input className={styles.crInput} placeholder="Media (ex: CFexpress)"
                value={newReport.storageMedia} onChange={e => setNewReport(p => ({ ...p, storageMedia: e.target.value }))} />
            </div>
            <button className={styles.setupBtn} style={{ alignSelf: 'flex-end', padding: '8px 16px' }} onClick={addReport}>
              <Plus size={14} /> Criar Report
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {cameraReports.length === 0 && !showForm && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
          Sem camera reports — {canEdit ? 'clica + para criar' : 'DIT/2ºAC cria durante o dia'}
        </p>
      )}

      {cameraReports.map(cr => (
        <div key={cr.id} style={{ marginTop: 10 }}>
          <p style={{ fontWeight: 600, fontSize: 'var(--text-sm)', margin: '0 0 6px' }}>
            Câmara {cr.cameraId} — {cr.camera || 'N/A'} · Cartão #{cr.cardNumber}
          </p>
          {cr.clips?.map((clip, i) => (
            <div key={i} className={styles.crClipRow}>
              <span className={styles.crClipScene}>Sc.{clip.scene} T{clip.take}</span>
              <span className={`${styles.crClipStatus} ${clip.status === 'ok' ? styles.crStatusOk : styles.crStatusNok}`}>
                {clip.status?.toUpperCase()}
              </span>
              <span className={styles.crClipMeta}>
                {clip.lens || '—'} {clip.iso ? `ISO${clip.iso}` : ''} {clip.aperture || ''}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Next Day Card + WhatsApp ────────────────────────────────────
function NextDayCard({ nextDay, dayIndex, sceneAssignments, parsedScripts, locations, team, projectName, weather, engineResult, canEdit }) {
  // Build next day's scenes
  const nextScenes = useMemo(() => {
    const scenes = []
    Object.entries(sceneAssignments || {}).forEach(([sceneKey, dayId]) => {
      if (dayId === nextDay.id) {
        const [epId, sceneNum] = sceneKey.split('-')
        const ep = parsedScripts?.[epId]
        const scene = ep?.scenes?.find(s => String(s.sceneNumber) === sceneNum)
        scenes.push({
          number: sceneNum,
          location: scene?.heading?.location || scene?.location || '',
          intExt: scene?.heading?.intExt || scene?.intExt || '',
          dayNight: scene?.heading?.timeOfDay || scene?.dayNight || '',
          characters: scene?.characters || [],
          description: scene?.heading?.full || '',
        })
      }
    })
    scenes.sort((a, b) => Number(a.number) - Number(b.number))
    return scenes
  }, [nextDay.id, sceneAssignments, parsedScripts])

  // Unique locations
  const nextLocations = useMemo(() => {
    const unique = [...new Set(nextScenes.map(s => s.location).filter(Boolean))]
    return unique.map(name => {
      const loc = resolveLocation(locations, name)
      return loc || { name, address: '' }
    })
  }, [nextScenes, locations])

  // Engine data for next day
  const nextEngine = useMemo(() => {
    if (!engineResult?.days) return null
    return engineResult.days.find(d => d.id === nextDay.id) || null
  }, [engineResult?.days, nextDay.id])

  const callTime = nextDay.callTime || nextEngine?.callTime || '08:00'
  const wrapEstimate = nextEngine?.wrapTime ? minToTimeStr(nextEngine.wrapTime) : null

  const handleSendAll = () => {
    const msg = buildCallMessage({
      projectName,
      dayNumber: nextDay.dayNumber || dayIndex + 2,
      date: nextDay.date,
      callTime,
      locations: nextLocations.map(l => ({ name: l.name, address: l.address, parking: l.parkingNotes })),
      scenes: nextScenes,
      weather: weather ? {
        description: weather.current?.description || '',
        temp: weather.current?.temp ? Math.round(weather.current.temp) : null,
        alert: nextScenes.some(s => s.intExt?.toUpperCase()?.includes('EXT'))
          ? (weather.current?.description?.toLowerCase()?.includes('chuva') ? 'Possibilidade de chuva — cenas EXT' : null)
          : null,
      } : null,
      wrapEstimate,
    })
    openWhatsApp(null, msg)
  }

  const handleSendActor = (member) => {
    const charName = member.characterName
    const actorScenes = charName
      ? nextScenes.filter(s => s.characters.some(c => c.toLowerCase() === charName.toLowerCase()))
      : nextScenes
    if (actorScenes.length === 0) return

    const msg = buildActorCallMessage({
      projectName,
      dayNumber: nextDay.dayNumber || dayIndex + 2,
      date: nextDay.date,
      callTime,
      actorName: member.name,
      characterName: charName,
      scenes: actorScenes,
      location: nextLocations[0],
    })
    openWhatsApp(member.phone, msg)
  }

  // Cast for next day
  const nextCast = useMemo(() => {
    const chars = new Set()
    nextScenes.forEach(s => s.characters?.forEach(c => chars.add(c.toLowerCase())))
    return team.filter(m =>
      m.group === 'Elenco' && m.characterName && chars.has(m.characterName.toLowerCase()) && m.phone
    )
  }, [nextScenes, team])

  return (
    <div className={styles.nextDayCard}>
      <div className={styles.nextDayHeader}>
        <div>
          <h3 className={styles.nextDayTitle}>
            Amanhã — Dia {nextDay.dayNumber || dayIndex + 2}
            {nextDay.date && ` · ${nextDay.date}`}
          </h3>
          <p className={styles.nextDayScenes}>
            {nextScenes.length > 0
              ? nextScenes.map(s => `Sc.${s.number}`).join(', ')
              : 'Cenas por atribuir'}
            {nextLocations.length > 0 && ` · ${nextLocations.map(l => l.name).join(', ')}`}
          </p>
        </div>

        {canEdit && nextScenes.length > 0 && (
          <button className={styles.whatsappBtn} onClick={handleSendAll} title="Enviar convocatória por WhatsApp">
            <MessageCircle size={14} /> Enviar convocatória
          </button>
        )}
      </div>

      {/* Send to individual actors */}
      {canEdit && nextCast.length > 0 && (
        <div className={styles.nextDayCast}>
          {nextCast.map(m => (
            <button key={m.id} className={styles.nextDayCastBtn} onClick={() => handleSendActor(m)} title={`Enviar a ${m.name}`}>
              <Send size={10} /> {m.name?.split(' ')[0]} ({m.characterName})
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Catering Editor ───────────────────────────────────────────────
function CateringEditor({ dayData, canEdit, onUpdate, team, dayRsvp }) {
  const catering = dayData?.catering || {}
  const [newItem, setNewItem] = useState('')

  const update = (patch) => onUpdate({ catering: { ...catering, ...patch } })

  // Count menu choices from RSVP
  const menuCounts = useMemo(() => {
    const counts = {}
    Object.values(dayRsvp || {}).forEach(r => {
      if (r.menuChoice) counts[r.menuChoice] = (counts[r.menuChoice] || 0) + 1
    })
    return counts
  }, [dayRsvp])

  // Dietary summary
  const dietarySummary = useMemo(() => {
    const diets = {}
    team.forEach(m => {
      if (m.dietary) {
        const d = m.dietary.trim().toLowerCase()
        diets[d] = (diets[d] || 0) + 1
      }
    })
    return diets
  }, [team])

  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}><Coffee size={14} /> Catering / Almoço</h3>
      {canEdit ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, display: 'block' }}>Horário</label>
              <input
                className={styles.callInput}
                style={{ width: '100%', textAlign: 'left', fontSize: 13 }}
                value={catering.time || ''}
                onChange={e => update({ time: e.target.value })}
                placeholder="13:00 - 14:00"
              />
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, display: 'block' }}>Local</label>
              <input
                className={styles.callInput}
                style={{ width: '100%', textAlign: 'left', fontSize: 13 }}
                value={catering.location || ''}
                onChange={e => update({ location: e.target.value })}
                placeholder="Tenda Principal"
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, display: 'block' }}>Fornecedor</label>
            <input
              className={styles.callInput}
              style={{ width: '100%', textAlign: 'left', fontSize: 13 }}
              value={catering.provider || ''}
              onChange={e => update({ provider: e.target.value })}
              placeholder="Nome do catering"
            />
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Menu</label>
            {(catering.menu || []).map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>{item}</span>
                {menuCounts[item] > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>{menuCounts[item]}×</span>
                )}
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                  onClick={() => update({ menu: (catering.menu || []).filter((_, j) => j !== i) })}
                >×</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className={styles.callInput}
                style={{ flex: 1, textAlign: 'left', fontSize: 12 }}
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                placeholder="Adicionar opção…"
                onKeyDown={e => {
                  if (e.key === 'Enter' && newItem.trim()) {
                    update({ menu: [...(catering.menu || []), newItem.trim()] })
                    setNewItem('')
                  }
                }}
              />
              <button
                style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: 11, cursor: 'pointer', opacity: newItem.trim() ? 1 : 0.4 }}
                disabled={!newItem.trim()}
                onClick={() => {
                  if (newItem.trim()) {
                    update({ menu: [...(catering.menu || []), newItem.trim()] })
                    setNewItem('')
                  }
                }}
              ><Plus size={12} /></button>
            </div>
          </div>
          {Object.keys(dietarySummary).length > 0 && (
            <div style={{ marginTop: 4, padding: '6px 8px', background: 'rgba(251,191,36,0.06)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(251,191,36,0.15)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--health-yellow)', display: 'block', marginBottom: 3 }}>DIETAS ESPECIAIS</span>
              {Object.entries(dietarySummary).map(([diet, count]) => (
                <span key={diet} style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block' }}>
                  {diet} ({count})
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '0 0 4px' }}>
            <Clock size={12} /> {catering.time || '13:00 - 14:00'}
          </p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
            <MapPin size={12} /> {catering.location || 'A definir'}
          </p>
          {(catering.menu || []).length > 0 && (
            <div style={{ marginTop: 6 }}>
              {catering.menu.map((item, i) => (
                <p key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0' }}>· {item}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── FALA DO DIA — Hero Quote ──────────────────────────────────────
const MOTIVATIONAL_QUOTES = [
  { text: 'O cinema é a escrita moderna cujo tinta é a luz.', source: 'Jean Cocteau' },
  { text: 'Cada plano é um pedaco de tempo que nunca regressa.', source: 'Andrei Tarkovsky' },
  { text: 'A magia acontece quando a equipa acredita na mesma historia.', source: 'Provérbio de set' },
]

function HeroQuoteCard({ dayScenes, parsedScripts }) {
  const quote = useMemo(() => {
    // Try to find the first dialogue line from the first scene of the day
    if (dayScenes.length > 0) {
      const firstScene = dayScenes[0]
      const ep = parsedScripts?.[firstScene.episodeId]
      const fullScene = ep?.scenes?.find(s => String(s.sceneNumber) === String(firstScene.sceneNumber))
      if (fullScene?.dialogue?.length > 0) {
        const d = fullScene.dialogue[0]
        return {
          text: typeof d === 'string' ? d : (d.text || d.line || d.content || String(d)),
          source: typeof d === 'object' && d.character ? `${d.character} — Cena ${firstScene.sceneNumber}` : `Cena ${firstScene.sceneNumber}`,
        }
      }
      // Try content/action as fallback for a scene excerpt
      if (fullScene?.action?.[0]) {
        const actionLine = fullScene.action[0].length > 120 ? fullScene.action[0].slice(0, 120) + '...' : fullScene.action[0]
        return { text: actionLine, source: `Cena ${firstScene.sceneNumber} — Accao` }
      }
    }
    // Fallback: motivational quote
    return MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]
  }, [dayScenes, parsedScripts])

  return (
    <div className={styles.heroQuote}>
      <p className={styles.heroQuoteLabel}>FALA DO DIA</p>
      <p className={styles.heroQuoteText}>&ldquo;{quote.text}&rdquo;</p>
      <p className={styles.heroQuoteSource}>{quote.source}</p>
    </div>
  )
}

// ── Timeline Event Cards ─────────────────────────────────────────
function TimelineCards({ engineDay, parsedScripts, filter, expandedScene, setExpandedScene }) {
  const TURNAROUND_MIN = 10

  // Build flat list of events from engine blocks
  const events = useMemo(() => {
    const items = []
    ;(engineDay?.blocos || []).forEach((bloco, i) => {
      if (bloco.tipo === 'almoco') {
        items.push({
          type: 'meal',
          time: bloco.hora_inicio,
          endTime: bloco.hora_fim,
          duration: bloco.duracao,
          label: 'ALMOCO',
        })
        return
      }

      let cursor = bloco.inicio_min || 0
      ;(bloco.cenas || []).forEach((sc, j) => {
        if (j > 0) cursor += TURNAROUND_MIN
        const start = cursor
        cursor += sc.duration || 0
        const [epId, scNum] = (sc.sceneKey || '').split('-')
        const fullScene = parsedScripts?.[epId]?.scenes?.find(s => String(s.sceneNumber) === scNum)
        const dialogueLine = fullScene?.dialogue?.[0]
        const dialogueText = dialogueLine
          ? (typeof dialogueLine === 'string' ? dialogueLine : (dialogueLine.text || dialogueLine.line || ''))
          : ''

        items.push({
          type: 'scene',
          time: minToTimeStr(start),
          endTime: minToTimeStr(cursor),
          duration: sc.duration || 0,
          sceneKey: sc.sceneKey,
          location: bloco.location || sc.location || '',
          intExt: sc.intExt || '',
          dayNight: sc.dayNight || '',
          sceneType: sc.sceneType || '',
          characters: sc.characters || [],
          dialogue: dialogueText.length > 80 ? dialogueText.slice(0, 80) + '...' : dialogueText,
          color: bloco.color,
        })
      })

      // Add a crew call event for the first block
      if (i === 0 && engineDay.callTime) {
        items.unshift({
          type: 'call',
          time: engineDay.callTime,
          label: 'Crew Call',
        })
      }
    })

    // Add wrap if available
    if (engineDay?.wrapTime) {
      items.push({
        type: 'call',
        time: engineDay.wrapTime,
        label: 'Wrap',
      })
    }

    return items
  }, [engineDay, parsedScripts])

  // Apply filter
  const filtered = useMemo(() => {
    switch (filter) {
      case 'cenas': return events.filter(e => e.type === 'scene')
      case 'calls': return events.filter(e => e.type === 'call')
      case 'meals': return events.filter(e => e.type === 'meal')
      case 'meu': return events.filter(e => e.type === 'scene') // placeholder: show all scenes
      default: return events
    }
  }, [events, filter])

  if (filtered.length === 0) return null

  return (
    <div style={{ marginBottom: 14 }}>
      {filtered.map((evt, i) => {
        if (evt.type === 'scene') {
          return (
            <div
              key={`tl-${i}`}
              className={styles.timelineCard}
              onClick={() => setExpandedScene(expandedScene === evt.sceneKey ? null : evt.sceneKey)}
            >
              <div className={styles.timelineTime}>
                <span className={styles.timelineTimeValue}>{evt.time}</span>
                <span className={styles.timelineTimeDuration}>{evt.duration}min</span>
              </div>
              <div className={styles.timelineContent}>
                <span className={styles.timelineTitle}>{evt.sceneKey}</span>
                <span className={styles.timelineLocation}>{evt.location}</span>
                <div className={styles.timelineBadges}>
                  {evt.intExt && <span className={styles.timelineBadge}>{evt.intExt}</span>}
                  {evt.dayNight && <span className={styles.timelineBadge}>{evt.dayNight}</span>}
                  {evt.sceneType && <span className={styles.timelineBadge}>{evt.sceneType}</span>}
                </div>
                {evt.dialogue && (
                  <span className={styles.timelineDialogue}>&ldquo;{evt.dialogue}&rdquo;</span>
                )}
              </div>
              <div className={styles.timelineMeta}>
                {evt.characters.length > 0 && (
                  <span className={styles.timelineMetaItem}>
                    <Users size={12} /> {evt.characters.length}
                  </span>
                )}
                <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
              </div>
            </div>
          )
        }

        // Non-scene events (meal, call, wrap)
        return (
          <div key={`tl-${i}`} className={styles.timelineCardSimple}>
            <div className={styles.timelineTime}>
              <span className={styles.timelineTimeValue}>{evt.time}</span>
              {evt.duration && <span className={styles.timelineTimeDuration}>{evt.duration}min</span>}
            </div>
            <span className={styles.timelineSimpleLabel}>
              {evt.type === 'meal' && <Coffee size={14} style={{ marginRight: 6, verticalAlign: 'middle', color: 'var(--health-yellow)' }} />}
              {evt.label}{evt.endTime ? ` → ${evt.endTime}` : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Parking Editor ────────────────────────────────────────────────
function ParkingEditor({ dayData, canEdit, onUpdate, team }) {
  const parking = dayData?.parking || []
  const [editMember, setEditMember] = useState('')
  const [editSpot, setEditSpot] = useState('')

  const addParking = () => {
    if (!editMember || !editSpot.trim()) return
    const existing = parking.filter(p => p.memberId !== editMember)
    onUpdate({ parking: [...existing, { memberId: editMember, spot: editSpot.trim() }] })
    setEditMember('')
    setEditSpot('')
  }

  const removeParking = (memberId) => {
    onUpdate({ parking: parking.filter(p => p.memberId !== memberId) })
  }

  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>🅿️ Estacionamento</h3>
      {parking.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
          {parking.map(p => {
            const m = team.find(t => t.id === p.memberId)
            return (
              <div key={p.memberId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: 'var(--accent)', minWidth: 40 }}>{p.spot}</span>
                <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{m?.name || p.memberId}</span>
                {canEdit && (
                  <button
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}
                    onClick={() => removeParking(p.memberId)}
                  >×</button>
                )}
              </div>
            )
          })}
        </div>
      )}
      {canEdit && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select
            className={styles.callInput}
            style={{ flex: 1, textAlign: 'left', fontSize: 12 }}
            value={editMember}
            onChange={e => setEditMember(e.target.value)}
          >
            <option value="">Membro…</option>
            {team.filter(m => !parking.some(p => p.memberId === m.id)).map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <input
            className={styles.callInput}
            style={{ width: 80, textAlign: 'left', fontSize: 12 }}
            value={editSpot}
            onChange={e => setEditSpot(e.target.value)}
            placeholder="Lugar"
            onKeyDown={e => e.key === 'Enter' && addParking()}
          />
          <button
            style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: 11, cursor: 'pointer', opacity: (editMember && editSpot.trim()) ? 1 : 0.4 }}
            disabled={!editMember || !editSpot.trim()}
            onClick={addParking}
          ><Plus size={12} /></button>
        </div>
      )}
      {parking.length === 0 && !canEdit && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>Sem lugares atribuídos</p>
      )}
    </div>
  )
}

// ── Scene Angle Annotations (Script Supervisor Tool) ─────────────
// Allows annotating "good setups" per scene: lens, aperture, ISO, focal, notes, rating

const ANGLE_TYPES = [
  { id: 'master', label: 'Master' },
  { id: 'medium', label: 'Medium' },
  { id: 'close', label: 'Close-Up' },
  { id: 'insert', label: 'Insert' },
  { id: 'ots', label: 'OTS' },
  { id: 'pov', label: 'POV' },
  { id: 'wide', label: 'Wide' },
  { id: 'crane', label: 'Crane/Jib' },
  { id: 'steadicam', label: 'Steadicam' },
  { id: 'handheld', label: 'Handheld' },
  { id: 'dolly', label: 'Dolly' },
  { id: 'drone', label: 'Drone' },
  { id: 'other', label: 'Outro' },
]

function SceneAngleAnnotations({ sceneKey, annotations, onUpdate, canEdit }) {
  const [adding, setAdding] = useState(false)
  const angles = annotations?.angles || []
  const continuityNotes = annotations?.continuityNotes || ''

  const addAngle = () => {
    const newAngle = {
      id: Date.now().toString(36),
      type: 'master',
      lens: '',
      fStop: '',
      iso: '',
      focal: '',
      notes: '',
      rating: 0, // 0-3 stars
      timestamp: new Date().toISOString(),
    }
    onUpdate(sceneKey, { angles: [...angles, newAngle] })
    setAdding(false)
  }

  const updateAngle = (angleId, patch) => {
    onUpdate(sceneKey, {
      angles: angles.map(a => a.id === angleId ? { ...a, ...patch } : a),
    })
  }

  const removeAngle = (angleId) => {
    onUpdate(sceneKey, {
      angles: angles.filter(a => a.id !== angleId),
    })
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      padding: '6px 0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
          <Aperture size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Ângulos / Setups ({angles.length})
        </span>
        {canEdit && (
          <button
            onClick={addAngle}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.25)', borderRadius: 'var(--radius-sm)',
              color: 'var(--health-green)', fontSize: 10, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={10} /> Ângulo
          </button>
        )}
      </div>

      {angles.length === 0 && (
        <p style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
          Sem ângulos anotados. {canEdit ? 'Adiciona setups, lentes e notas.' : ''}
        </p>
      )}

      {angles.map(angle => (
        <div key={angle.id} style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 'var(--radius-sm)', padding: '8px 10px',
          display: 'flex', flexDirection: 'column', gap: 5,
        }}>
          {/* Row 1: Type + Rating + Delete */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {canEdit ? (
              <select
                value={angle.type}
                onChange={e => updateAngle(angle.id, { type: e.target.value })}
                onClick={e => e.stopPropagation()}
                style={{
                  padding: '3px 6px', background: 'var(--bg-elevated)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)', fontSize: 11, fontWeight: 600,
                }}
              >
                {ANGLE_TYPES.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                {ANGLE_TYPES.find(t => t.id === angle.type)?.label || angle.type}
              </span>
            )}

            {/* Star rating (0-3) */}
            <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
              {[1, 2, 3].map(star => (
                <button
                  key={star}
                  onClick={e => { e.stopPropagation(); if (canEdit) updateAngle(angle.id, { rating: angle.rating === star ? 0 : star }) }}
                  style={{
                    background: 'none', border: 'none', padding: 0, cursor: canEdit ? 'pointer' : 'default',
                    color: star <= (angle.rating || 0) ? 'var(--health-yellow)' : 'rgba(255,255,255,0.15)',
                    fontSize: 14, lineHeight: 1,
                  }}
                >
                  <Star size={13} fill={star <= (angle.rating || 0) ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>

            {canEdit && (
              <button
                onClick={e => { e.stopPropagation(); removeAngle(angle.id) }}
                style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>

          {/* Row 2: Tech specs (editable inputs) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {[
              { key: 'lens', placeholder: 'Lente (ex: 50mm)', width: 90 },
              { key: 'fStop', placeholder: 'T/F-Stop', width: 60 },
              { key: 'iso', placeholder: 'ISO', width: 50 },
              { key: 'focal', placeholder: 'Focal eq.', width: 60 },
            ].map(field => (
              canEdit ? (
                <input
                  key={field.key}
                  value={angle[field.key] || ''}
                  onChange={e => { e.stopPropagation(); updateAngle(angle.id, { [field.key]: e.target.value }) }}
                  onClick={e => e.stopPropagation()}
                  placeholder={field.placeholder}
                  style={{
                    width: field.width, padding: '3px 6px', fontSize: 10,
                    background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--accent-light)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
              ) : (
                angle[field.key] ? (
                  <span key={field.key} style={{
                    padding: '2px 6px', fontSize: 10, background: 'rgba(0,0,0,0.2)',
                    borderRadius: 3, color: 'var(--accent-light)', fontVariantNumeric: 'tabular-nums',
                  }}>
                    {field.placeholder.split(' ')[0]}: {angle[field.key]}
                  </span>
                ) : null
              )
            ))}
          </div>

          {/* Row 3: Notes */}
          {canEdit ? (
            <input
              value={angle.notes || ''}
              onChange={e => { e.stopPropagation(); updateAngle(angle.id, { notes: e.target.value }) }}
              onClick={e => e.stopPropagation()}
              placeholder="Notas (ângulo, movimento, observações)…"
              style={{
                width: '100%', padding: '3px 6px', fontSize: 10,
                background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
              }}
            />
          ) : (
            angle.notes && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {angle.notes}
              </span>
            )
          )}
        </div>
      ))}

      {/* Continuity notes for this scene */}
      <div style={{ marginTop: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
          Notas de Continuidade
        </span>
        {canEdit ? (
          <textarea
            value={continuityNotes}
            onChange={e => { e.stopPropagation(); onUpdate(sceneKey, { continuityNotes: e.target.value }) }}
            onClick={e => e.stopPropagation()}
            placeholder="Observações de raccord, adereços, posições, iluminação…"
            rows={2}
            style={{
              width: '100%', padding: '4px 8px', fontSize: 10,
              background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
              resize: 'vertical', fontFamily: 'var(--font-body)',
            }}
          />
        ) : (
          <span style={{ fontSize: 10, color: continuityNotes ? 'var(--text-secondary)' : 'var(--text-muted)', fontStyle: continuityNotes ? 'normal' : 'italic' }}>
            {continuityNotes || 'Sem notas de continuidade'}
          </span>
        )}
      </div>
    </div>
  )
}
