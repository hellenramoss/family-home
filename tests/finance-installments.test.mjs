import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const window={};vm.runInNewContext(readFileSync(new URL('../public/finance-installments.js',import.meta.url),'utf8'),{window});
test('distribui centavos sem perder valor e avança entre anos',()=>{const rows=window.familyFinanceInstallments.split('100,00',3,'2026-11');assert.equal(rows.map(x=>x.cents).join(','),'3334,3333,3333');assert.equal(rows.map(x=>x.month).join(','),'2026-11,2026-12,2027-01');assert.equal(rows.reduce((n,x)=>n+x.cents,0),10000)});
test('recusa valores e datas inválidos',()=>{assert.throws(()=>window.familyFinanceInstallments.split('10,001',3,'2026-11'));assert.throws(()=>window.familyFinanceInstallments.split('10,00',0,'2026-11'));assert.throws(()=>window.familyFinanceInstallments.split('10,00',3,'2026-13'))});
test('interpreta parcelas históricas sem supor informações ausentes',()=>{const parse=window.familyFinanceInstallments.parseExisting;assert.equal(parse(' 2 DE 10 ').remaining,8);assert.equal(parse('3/3').remaining,0);assert.equal(parse('ÚLTIMA').type,'last');assert.equal(parse('recorrente ').type,'recurring');assert.equal(parse('5 de 2').type,'unknown');assert.equal(parse('').type,'unknown')});
test('projeta apenas parcelas restantes em competências posteriores',()=>{const project=window.familyFinanceInstallments.projectExisting;const rows=project('2 de 4',1234,'2026-11');assert.equal(rows.map(x=>x.month).join(','),'2026-12,2027-01');assert.equal(rows.map(x=>x.number).join(','),'3,4');assert.equal(rows.reduce((n,x)=>n+x.cents,0),2468);assert.equal(project('última',100,'2026-11').length,0);assert.equal(project('recorrente',100,'2026-11').length,0)});
