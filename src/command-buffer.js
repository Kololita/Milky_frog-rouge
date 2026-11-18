/** One next command, valid until its owning action finishes or is cancelled. */
export class CommandBuffer {
  constructor() { this.clear(); }
  clear() { this.pending=null; }
  push(name, owner, aim = null) {
    this.pending={name,owner,aim:aim ? {x:aim.x,z:aim.z} : null};
  }
  has(owner) {
    return Boolean(this.pending && this.pending.owner===owner);
  }
  take(owner) {
    const command=this.has(owner) ? this.pending : null;
    this.clear();
    return command;
  }
}
