import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { recommend } from "../src/feeding.js";

const programs = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "programs.json"), "utf8"));

test("pollo de engorde: etapa por edad y cálculo de sacos", () => {
  const r = recommend(programs, { especie: "pollo_engorde", edad_dias: 10, cantidad: 100 });
  assert.match(r.alimento_actual, /Iniciarina/);
  assert.match(r.proximo_cambio, /Engordina el día 22/);
  assert.equal(r.calculo.total_lb, 1000);
  assert.equal(r.calculo.total_sacos_100lb, 10);
  assert.deepEqual(
    r.calculo.por_etapa.map((e) => [e.producto, e.lb_total, e.sacos_100lb]),
    [
      ["Preiniciarina Plus LA", 40, 1],
      ["Iniciarina", 220, 3],
      ["Engordina", 740, 8],
    ],
  );
});

test("pollo de engorde: calendario con fecha de nacimiento", () => {
  const r = recommend(programs, { especie: "pollo_engorde", fecha_nacimiento: "2026-09-01", cantidad: 50 });
  assert.equal(r.calendario[1].desde, "2026-09-08");
  assert.equal(r.calendario[2].desde, "2026-09-22");
  assert.equal(r.calendario[2].hasta, "2026-10-12");
});

test("gallinas ponedoras: producto según patio/granja y sacos por consumo", () => {
  const patio = recommend(programs, { especie: "gallina_ponedora", edad_semanas: 30, detalle: "patio" });
  assert.match(patio.alimento_actual, /Posturina Fase 1/);
  const granja = recommend(programs, { especie: "gallina_ponedora", edad_semanas: 30, detalle: "granja" });
  assert.match(granja.alimento_actual, /Posturina HP/);
  const levante = recommend(programs, { especie: "gallina_ponedora", edad_semanas: 10 });
  assert.equal(levante.pasar_a_asesor, true);
  const calc = recommend(programs, { especie: "gallina_ponedora", cantidad: 25, dias: 30 });
  assert.equal(calc.calculo.consumo_g_por_gallina_dia, 112);
  assert.equal(calc.calculo.dias_por_saco, 16.2);
  assert.equal(calc.calculo.sacos_100lb, 2);
});

test("cerdos: NeoPigg por programa, línea desde el día 71 y sacos especiales", () => {
  const r = recommend(programs, { especie: "cerdo", edad_dias: 32, programa_cerdos: "plus", cantidad: 10 });
  assert.match(r.alimento_actual, /Neopigg 2/);
  const np1 = r.calculo.por_etapa[0];
  assert.equal(np1.producto, "Neopigg 1");
  assert.equal(np1.lb_total, 50);
  assert.equal(np1.saco, "44 lb (20 kg)");
  assert.equal(np1.sacos, 2);
  const std = recommend(programs, { especie: "cerdo", edad_dias: 80 });
  assert.match(std.alimento_actual, /Desarrollina/);
  const nova = recommend(programs, { especie: "cerdo", edad_dias: 100, linea_cerdos: "pignova" });
  assert.match(nova.alimento_actual, /Pig-Nova 6/);
  const total = recommend(programs, { especie: "cerdo", cantidad: 1 });
  assert.equal(total.calculo.total_lb, 527);
});

test("cerdas, caballos, mascotas y ganado", () => {
  assert.match(recommend(programs, { especie: "cerda_reproductora", etapa_cerda: "lactancia" }).alimento_actual, /Lacticerdina/);
  assert.ok(recommend(programs, { especie: "cerda_reproductora" }).pregunta);
  assert.equal(recommend(programs, { especie: "caballo", detalle: "yegua preñada" }).sugerencia, "Omalina 300 (id 8)");
  assert.ok(recommend(programs, { especie: "caballo" }).pregunta);
  assert.deepEqual(recommend(programs, { especie: "perro", edad_meses: 4 }).productos_ids, [13, 16, 17, 35, 40]);
  assert.equal(recommend(programs, { especie: "gato", edad_meses: 3 }).pasar_a_asesor, true);
  assert.equal(recommend(programs, { especie: "ganado" }).pasar_a_asesor, true);
  assert.ok(recommend(programs, { especie: "dinosaurio" }).error);
});
