const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const s = new mongoose.Schema({ name:{type:String,required:true}, email:{type:String,required:true,unique:true}, password:{type:String,required:true}, role:{type:String,default:'admin'}, createdAt:{type:Date,default:Date.now} });
s.pre('save', async function(next) { if (!this.isModified('password')) return next(); this.password = await bcrypt.hash(this.password, 10); next(); });
s.methods.comparePassword = async function(p) { return bcrypt.compare(p, this.password); };
module.exports = mongoose.model('Admin', s);
