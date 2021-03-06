/*
x86 core instruction set
Copyright (C) 2011 Kasper Fabæch Brandt

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; either version 2
of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
*/

(function () //non-global scope
{
	var getValByMode = function(src,mode)
	{
		if (mode)
			return src;
		return '('+src+' & 0x0000FFFF)';
	}
	var setValByMode = function(dst,src,mode)
	{
		if (mode)
			return dst+' = '+src+';';
		return dst+' = '+src+' | ('+dst+' & 0xFFFF0000);';
	}
	var setValL8 = function(dst,src)
	{
		return dst+' = '+src+' | ('+dst+' & 0xFFFFFF00);';
	}
	var setValH8 = function(dst,src)
	{
		return dst+' = ('+src+' << 8) | ('+dst+' & 0xFFFF00FF);';
	}
	
	//i = {prefixes, opcode, modRM, SIB, disp, imm, op1, op2, info}
	var iNone = {hasModRM: false,
		 SIBMode: jsx86.instruction.SIBMode.none,
		 op1Mode: jsx86.instruction.OpMode.none,
		 op2Mode: jsx86.instruction.OpMode.none,
		 flags: {},
		 dispSize: jsx86.instruction.FieldLength.none,
		 immSize: jsx86.instruction.FieldLength.none};
	var iGvEv = {hasModRM: true,
		 SIBMode: jsx86.instruction.SIBMode.byModRM,
		 op1Mode: jsx86.instruction.OpMode.rOperandSize,
		 op2Mode: jsx86.instruction.OpMode.rOperandSize,
		 flags: {},
		 dispSize: jsx86.instruction.FieldLength.byModRM,
		 memSize: jsx86.instruction.FieldLength.byMode,
		 immSize: jsx86.instruction.FieldLength.none};
	var iEvGv = unionMaps(iGvEv, {flags: {ReverseArgs: true}});
	var iGbEb = unionMaps(iEvGv, {
		 op1Mode: jsx86.instruction.OpMode.r8,
		 op2Mode: jsx86.instruction.OpMode.r8,
		 memSize: jsx86.instruction.FieldLength.byMode});
	var iEbGb = unionMaps(iGbEb, {flags: {ReverseArgs: true}});
	var iEvSw = unionMaps(iEvGv,{
		op1Mode: jsx86.instruction.OpMode.segment,
		memSize: jsx86.instruction.FieldLength.one});
	var iSwEv = unionMaps(iEvSw, {flags: {ReverseArgs: true}});
	var iOb = unionMaps(iNone,{
		dispSize: jsx86.instruction.FieldLength.byMode,
		memSize: jsx86.instruction.FieldLength.one});
	var iOv = unionMaps(iNone,{
		dispSize: jsx86.instruction.FieldLength.byMode,
		memSize: jsx86.instruction.FieldLength.byMode});
	var iIb = unionMaps(iNone,{
		immSize: jsx86.instruction.FieldLength.one});
	var iIv = unionMaps(iNone,{
		immSize: jsx86.instruction.FieldLength.byMode});
	var iEvIv = unionMaps(iEvGv, {
		 op1Mode: jsx86.instruction.OpMode.none,
		 op2Mode: jsx86.instruction.OpMode.rOperandSize,
		 immSize: jsx86.instruction.FieldLength.byMode});	
	var iEbIb = unionMaps(iEvGv, {
		 op1Mode: jsx86.instruction.OpMode.none,
		 op2Mode: jsx86.instruction.OpMode.r8,
		 immSize: jsx86.instruction.FieldLength.one,
		 memSize: jsx86.instruction.FieldLength.one});
	var iEv = unionMaps(iEvGv, {
		 op1Mode: jsx86.instruction.OpMode.none});
	var movTrans = function (i)
	{
		return i.op1[1](i.op2[0])
	}
	var movMap = {translator: movTrans};
	var mask = [0, 0xFF, 0xFFFF, 0xFFFFFF, 0xFFFFFFFF];
	var smask = [0, 0x7F, 0x7FFF, 0x7FFFFF, 0x7FFFFFFF];
	var ALIbTF = function (i,t)
	{
		i.op2[0] = i.imm;
		i.op1 = jsx86.instruction.r8Map[0]
		return t(i);		
	}
	var rAXIvTF = function (i,t)
	{
		i.op2[0] = i.imm;
		i.op1 = i.longOp ? jsx86.instruction.r16Map[0] :
			jsx86.instruction.r16Map[0];
		return t(i);
	}
	var transformMap = function (m1,transform,translator)
	{
		return unionMaps(m1,{
			translator: function (i)
			{
				return transform(i,translator)
			}
		});
	}
	var registerBinOp = function(op, t)
	{
		var map = {translator: t};
		//* Eb,Gb  +0x00
		jsx86.instruction.registerB1Instruction(op+0, unionMaps(iEbGb,map));
		//* Ev,Gv  +0x01
		jsx86.instruction.registerB1Instruction(op+1, unionMaps(iEvGv,map));
		//* Gb,Eb  +0x02
		jsx86.instruction.registerB1Instruction(op+2, unionMaps(iGbEb,map));
		//* Gv,Ev  +0x03
		jsx86.instruction.registerB1Instruction(op+3, unionMaps(iGvEv,map));
		//* AL,Ib  +0x04
		jsx86.instruction.registerB1Instruction(op+4, transformMap(iIb,ALIbTF,t));
		//* rAX,Iz +0x05
		jsx86.instruction.registerB1Instruction(op+5, transformMap(iIv,rAXIvTF,t));		
	}
	var parityMap = [];
	for (var i = 0; i<=0xFF; i++)
	{
		var c = (i&0x80)>>7 + (i&0x40)>>6 + (i&0x20)>>5 + (i&0x10)>>4 +
		        (i&0x08)>>3 + (i&0x04)>>2 + (i&0x02)>>1 +  i&0x01;
		parityMap[i] = !(c&1);
	}
	jsx86.utils.setFlags1 = function (r,flags)
	{
		flags.sf = !!(r & 0x80);
		flags.zf = r == 0;
		flags.pf = parityMap[r];
	}
	jsx86.utils.setFlags2 = function (r,flags)
	{
		flags.sf = !!(r & 0x8000);
		flags.zf = r == 0;
		flags.pf = parityMap[r & 0xFF];
	}
	jsx86.utils.setFlags4 = function (r,flags)
	{
		flags.sf = r < 0;
		flags.zf = r == 0;
		flags.pf = parityMap[r & 0xFF];
	}

	/*
	(0x80000000|0) + (0x80000000|0) = 
	-4294967296
	((0x80000000|0) + (0x80000000|0) ) | 0 =
	0
	((0x80000000|0) + (0x80000000|0) -1) | 0 =
	-1
	((0x80000000|0) + (0x80000000|0) -1) =
	-4294967297
	((0x80000000|0) + (0x80000000|0) -1) | 0 =
	-1
	positive signed overflow: a+b > 2147483647
		(a+b) | 0 < 0 < a+b 
	negative signed overflow: a+b < -2147483648
	 	a+b < (a+b) | 0 <= 0
	as 0x7FFFFFFF+0x7FFFFFFF = 0xFFFFFFFE both operands
	needs to be signed < 0 for unsigned overflow to be possible.
	so a negative signed overflow is exactly when an unsigned overflow occours
	For non-32 bit integers:
	a,b >= 0 <=> repr(a),repr(b) <= 0x7F*
		overflow if a+b > 0x7F*
	a,b < 0 <=> repr(a),repr(b) > 0x7F*
		overflow if unsigned overflow
	*/
	//returns [result,of,cf]
	jsx86.utils.add1 = function (a,b,c)
	{
		var v = a+b+c;
		var d = v&0xFF;
		var of = v>0xFF;
		var cf = (a>0x7F && b>0x7F && of) ||
		         (a<=0x7F && b<=0x7F && d>0x7F);
		var af = (a&7)+(b&7)+c > 7;
		return [d,of,cf,af];
	}
	jsx86.utils.add2 = function (a,b,c)
	{
		var v = a+b+c;
		var d = v&0xFFFF;
		var of = v>0xFFFF;
		var cf = (a>0x7FFF && b>0x7FFF && of) ||
		         (a<=0x7FFF && b<=0x7FFF && d>0x7FFF);
		var af = (a&7)+(b&7)+c > 7;
		return [d,of,cf,af];
	}
	jsx86.utils.add4 = function (a,b,c)
	{
		a = a|0;
		b = b|0;
		var v = a+b+c;
		var d = v|0;
		var of = (a<0||b<0) && d>=0;
		var cf = v<d;
		var af = (a&7)+(b&7)+c > 7;
		return [d,of,cf,af];
	}
	jsx86.utils.sub1 = function (a,b,c)
	{
		return jsx86.utils.add1(a,(0x100-b)&0xFF,c);
	}
	jsx86.utils.sub2 = function (a,b,c)
	{
		return jsx86.utils.add2(a,(0x10000-b)&0xFFFF,c);
	}
	jsx86.utils.sub4 = function (a,b,c)
	{
		return jsx86.utils.add4(a,-b,c);
	}

	var _addSubTrans = function (i,c,f)
	{
		var s = 'var x = u.'+f+i.opLen+'('+i.op1[0]+','+i.op2[0]+','+(c?c:0)+');';
		s += i.op1[1]('x[0]');
		s += 'c.eflags.of = x[1];';
		s += 'c.eflags.cf = x[2];';
		s += 'c.eflags.af = x[3];';
		s += 'u.setFlags'+i.opLen+'(x[0],c.eflags);';
		return s;
	}

	jsx86.debug.addSubTrans = _addSubTrans;

	var addTrans = function (i)
	{
		return _addSubTrans(i,0,'add');
	}
	
	var orTrans = function (i)
	{
		return i.op1[1]('('+i.op1[0]+'|'+i.op2[0]+')');
	}
	var adcTrans = function (i)
	{
		return _addSubTrans(i,'(c.eflags.cf?1:0)','add');
	}
	var sbbTrans = function (i)
	{
		return _addSubTrans(i,'(c.eflags.cf?1:0)','sub');
	}
	var andTrans = function (i)
	{
		return i.op1[1]('('+i.op1[0]+'&'+i.op2[0]+')');
	}
	var subTrans = function (i)
	{
		return _addSubTrans(i,0,'sub');
	}
	var xorTrans = function (i)
	{
		return i.op1[1]('('+i.op1[0]+'^'+i.op2[0]+')');
	}
	var cmpTrans = function (i)
	{
		var s = 'var x = u.sub'+i.opLen+'('+i.op1[0]+','+i.op2[0]+');';
		s += 'c.eflags.of = x[1];';
		s += 'c.eflags.cf = x[2];';
		s += 'c.eflags.af = x[3];';
		s += 'u.setFlags'+i.opLen+'(x[0],c.eflags);';
		return s;
	}
	
	//ADD 0x00-0x05
	registerBinOp(0x00, addTrans);
	//OR 0x08-0x0D
	registerBinOp(0x08, orTrans);
	//ADC 0x10-0x15
	registerBinOp(0x10, adcTrans);
	//SBB 0x18-0x1D
	registerBinOp(0x18, sbbTrans);
	//AND 0x20-0x25
	registerBinOp(0x20, andTrans);
	//SUB 0x28-0x2D
	registerBinOp(0x28, subTrans);
	//XOR 0x30-0x35
	registerBinOp(0x30, xorTrans);
	//CMP 0x38-0x3D
	registerBinOp(0x38, subTrans);

	var _incDecTrans = function (i,f)
	{
		var reg = i.opcode & 0x07;
		var map = i.longOp ? jsx86.instruction.r32Map :
		                     jsx86.instruction.r16Map;
		var op1 = map[reg];
		var s = 'var x = u.'+f+i.opLen+'('+op1[0]+',1);';
		s += op1[1]('x[0]');
		s += 'c.eflags.of = x[1];';
		s += 'c.eflags.af = x[3];';
		s += 'u.setFlags'+i.opLen+'(x[0],c.eflags);';
		return s;
	}

	var incTrans = function (i)
	{
		return _incDecTrans(i,'add');
	}
	var decTrans = function (i)
	{
		return _incDecTrans(i,'sub');
	}

	//INC e(reg) 0x40-0x47
	for (var i=0; i <= 7; i++)
		jsx86.instruction.registerB1Instruction(0x40|i,unionMaps(iNone,{translator: incTrans}));
	//DEC e(reg) 0x48-0x4F
	for (var i=0; i <= 7; i++)
		jsx86.instruction.registerB1Instruction(0x48|i,unionMaps(iNone,{translator: decTrans}));

	var pushTrans = function (i)
	{
		var reg = i.opcode & 0x07;
		var map = i.longOp ? jsx86.instruction.r32Map :
		                     jsx86.instruction.r16Map;
		var op1 = map[reg];
		var esp = i.longOp ? jsx86.instruction.r32Map[4]:
		                     jsx86.instruction.r16Map[4];
		var len = i.longOp ? 4 : 2;
		var s;
		s = 'm.set'+len+'('+esp[0]+'-'+len+','+op1[0]+');';
		s += esp[1]('('+esp[0]+'-'+len+')');
	}
	var popTrans = function (i)
	{
		var reg = i.opcode & 0x07;
		var map = i.longOp ? jsx86.instruction.r32Map :
		                     jsx86.instruction.r16Map;
		var op1 = map[reg];
		var esp = i.longOp ? jsx86.instruction.r32Map[4]:
		                     jsx86.instruction.r16Map[4];
		var len = i.longOp ? 4 : 2;
		var s;
		s = esp[1]('('+esp[0]+'+'+len+')');
		s += op1[1]('m.get'+len+'('+esp[0]+'-'+len+');');
	}
	
	//PUSH r(reg) 0x50-0x57
	for (var i=0; i <= 7; i++)
		jsx86.instruction.registerB1Instruction(0x50|i,unionMaps(iNone,{translator: pushTrans}));
	//PUSH r(reg) 0x58-0x5F
	for (var i=0; i <= 7; i++)
		jsx86.instruction.registerB1Instruction(0x58|i,unionMaps(iNone,{translator: popTrans}));

	//MOV Eb,Gb 0x88
	jsx86.instruction.registerB1Instruction(0x88, unionMaps(iEbGb,movMap));
	//MOV Ev,Gv 0x89
	jsx86.instruction.registerB1Instruction(0x89, unionMaps(iEvGv,movMap));
	//MOV Gb,Eb 0x8A
	jsx86.instruction.registerB1Instruction(0x8A, unionMaps(iGbEb,movMap));
	//MOV Gv,Ev 0x8B
	jsx86.instruction.registerB1Instruction(0x8B, unionMaps(iGvEv,movMap));
	//MOV Ev,Sw 0x8C
	jsx86.instruction.registerB1Instruction(0x8C, unionMaps(iEvSw,movMap));
	//LEA Gv,M 0x8D
	jsx86.instruction.registerB1Instruction(0x8D,
		unionMaps(iGvEv,{
			flags: {EffectiveAddress: true},
			translator: movTrans}));
	//MOV Sw,Ev 0x8E
	jsx86.instruction.registerB1Instruction(0x8E, unionMaps(iSwEv,movMap));
	//NOP 0x90
	jsx86.instruction.registerB1Instruction(0x90,
		unionMaps(iNone,{
			translator: function (i) {return ';'}}));
			
	//MOV AL,Ob 0xA0
	jsx86.instruction.registerB1Instruction(0xA0,
		unionMaps(iOb,{
			translator: function (i) {return setValL8('c.eax',i.op2[0])}}));
	//MOV rAX,Ov 0xA1
	jsx86.instruction.registerB1Instruction(0xA1,
		unionMaps(iOv,{
			translator: function (i) {return setValByMode('c.eax',i.op2[0],i.longOp)}}));
	//MOV Ob,AL 0xA2
	jsx86.instruction.registerB1Instruction(0xA2,
		unionMaps(iOb,{
			translator: function (i) {return i.op2[1]('c.eax & 0xFF')}}));
	//MOV Ov,rAX 0xA3
	jsx86.instruction.registerB1Instruction(0xA3,
		unionMaps(iOv,{
			translator: function (i) {return i.op2[1](getValByMode('c.eax',i.longOp))}}));
			
	//0xB0 - 0xB7
	//MOV immediate byte into byte register - low order byte is register
	var movib = function (i)
	{
		var reg = i.opcode & 0x0F;
		var set = jsx86.instruction.r8Map[reg][1];
		return set(i.imm);
	}
	var movibInf = unionMaps(iIb,{translator: movib});
	//MOV (r8),Ib 0xB0 - 0xB7
	for (var i=0; i <= 7; i++)
		jsx86.instruction.registerB1Instruction(0xB0|i,movibInf);
		
	//0xB8 - 0xBF
	//MOV immediate byte into (mode) register - lowest 3 bits is register
	var moviv = function (i)
	{
		var reg = i.opcode & 0x07;
		var map = i.longOp ? jsx86.instruction.r32Map :
		                     jsx86.instruction.r16Map;
		var set =  map[reg][1];
		return set(i.imm);
	}
	var movivInf = unionMaps(iIv,{
			translator: moviv});
	//MOV (rv),Iv 0xB8 - 0xBF
	for (var i=0; i <= 7; i++)
		jsx86.instruction.registerB1Instruction(0xB8|i,movivInf);
		
	//MOV Eb,Ib 0xC6 (ext 0)
	jsx86.instruction.registerB1InstructionEx(0xC6, 0,
		unionMaps(iEbIb,{
			translator: function (i) {return i.op1[1](i.imm)}}));
	//MOV Ev,Iz 0xC7 (ext 0)
	jsx86.instruction.registerB1InstructionEx(0xC7, 0,
		unionMaps(iEvIv,{
			translator: function (i) {return i.op1[1](i.imm)}}));
	
	//NOP Ev 0x0F 0D
	/*This encoding isn't listed under the description of NOP,
	  but it is in Volume 2B, Table A-3.
	  Note that both ndisasm and objdump errornously claims this to be an
	  encoding of prefetch.
	*/
	jsx86.instruction.registerB23Instruction(0x0D,0,
		unionMaps(iEv,{
			translator: function (i) {return ';'}}));
	//NOP Ev 0x0F 1F
	//This is the standard encoding of this strange instruction...
	jsx86.instruction.registerB23Instruction(0x1F,0,
		unionMaps(iEv,{
			translator: function (i) {return ';'}}));
})();
