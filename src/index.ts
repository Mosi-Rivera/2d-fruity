//#region Physics Shapes
interface IBox {
  x: number;
  y: number;
  w: number;
  h: number;
  right: number;
  left: number;
  bottom: number;
  top: number;
}
class Box implements IBox {
  x;
  y;
  w;
  h;
  right = 0;
  left = 0;
  top = 0;
  bottom = 0;
  color;
  private originX = 0;
  private originY = 0;
  constructor(
    x: number = 0,
    y: number = 0,
    w: number = 0,
    h: number = 0,
    color: string = "red"
  ) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.color = color;
    this.set_origin(0, 0);
  }
  set_originX(x: number) {
    this.originX = x;
    this.left = this.w * x;
    this.right = this.w - this.w * x;
    return this;
  }
  set_originY(y: number) {
    this.originY = y;
    this.top = this.h * y;
    this.bottom = this.h - this.h * y;
    return this;
  }
  set_origin(x: number, y: number = null) {
    this.set_originX(x);
    if (y !== null) this.set_originY(y);
    return this;
  }
  copy() {
    return new Box(this.x, this.y, this.w, this.h).set_origin(
      this.originX,
      this.originY
    );
  }
}
//#endregion

//#region Animation
class AnimationO {
  private fps = 1 / 8;
  private loop = 0;
  private frames_count;
  private frames;
  private timer = 0;
  private index = 0;
  private play = true;
  private manager;
  constructor(configs: any) {
    this.frames = configs.frames;
    this.frames_count = this.frames.length;
    if (typeof configs.fps === "number") this.fps = 1 / configs.fps;
    if (configs.loop) this.loop = configs.loop;
    if (!configs.manager) throw new Error("No animation manager provided.");
    this.manager = configs.manager;
  }
  get() {
    return this.frames[this.index];
  }
  update(delta: number) {
    if (this.play) {
      this.timer += delta;
      if (this.timer >= this.fps) {
        if (++this.index >= this.frames) {
          this.index = 0;
          this.loop--;
        }
        if (this.loop === 0) this.play = false;
        this.manager.stop();
      }
    }
  }
}

class SpriteAnimationManager {
  active: AnimationO = null;
  game;
  image;
  constructor(configs: any) {
    this.game = configs.game;
    this.image = configs.game.sprite_manager.get(configs.key);
  }
  update(delta: number) {
    this.active?.update(delta);
  }
  get() {
    let active = this.active;
    if (active) return active.get();
    else return this.image;
  }
  play(key: string) {
    let animation = this.game.animation_manager.get(key);
    if (animation) this.active = animation;
    else throw new Error("Invalid animation key");
  }
}

class AnimationsManager {
  private animations: Map<string, Animation> = new Map();
  get(key: string) {
    let result = this.animations.get(key);
    if (result) return result;
    return null;
  }
}
//#endregion

//#region STATE
class State {
  update: () => {};
  start: () => {};
  end: () => {};
  coroutine: () => {};
  coroutine_instance:() => {} = null;
  coroutine_timer:number = 0;
  constructor(update: () => {},coroutine: () => {}, start: () => {}, end: () => {}) {
    this.update = update;
    this.coroutine = coroutine;
    this.start = start;
    this.end = end;
  }
}
class StateManager {
  index: number = null;
  states: any = {};
  update(delta: number): void {
    let state = this.states[this.index];
    if (state.coroutine_instance)
    {
        state.coroutine_timer -= delta;
        if (state.coroutine_timer <= 0)
        {
            let time = state.coroutine_instance.next().value;
            state.coroutine_timer = time ? time : 0;
        }
    }
    if (state.update)
        state.update(delta);
  }
  set(key: number,parameter:any = null): void {
    let state = this.states;
    let active = state[this.index];
    if (active.end) active.end();
    this.index = key;
    active = state[this.index];
    if (active.start) active.start();
    if (active.coroutine)
    {
        active.coroutine_timer = 0;
        active.coroutine_instance = active.coroutine(parameter);
    }
  }
  add(
    key: number,
    update: () => {} = null,
    coroutine: () => {} = null,
    start: () => {} = null,
    end: () => {} = null,
    default_value = false
  ) {
    if (this.states[key])
      throw new Error("Key already exists in state manager");
    this.states[key] = new State(update, coroutine, start, end);
    if (default_value) this.index = key;
  }
  remove(key: number) {
    delete this.states[key];
  }
}
//#endregion

//#region Camera
class Camera {
  private x;
  private y;
  private w;
  private h;
  private wd2;
  private hd2;
  private game;
  private follow = false;
  constructor(config: any) {
    this.game = config.game;
    this.x = config.x;
    this.y = config.y;
    this.h = config.h;
    this.w = config.w;
    this.hd2 = this.h / 2;
    this.wd2 = this.w / 2;
  }
  public set_follow(b: boolean): void {
    this.follow = b;
  }
  public is_in_view(box: IBox): boolean {
    if (
      box.x + box.right < this.x ||
      box.x - box.left > this.x + this.w ||
      box.y - box.top > this.y + this.h ||
      box.y + box.bottom < this.y
    )
      return false;
    return true;
  }
}
//#endregion

//#region Collision
class Collision {
  static is_colliding(b1: IBox, b2: IBox): boolean {
    if (
      b1.x + b1.right <= b2.x - b2.left ||
      b1.x - b1.left >= b2.x + b2.right ||
      b1.y + b1.bottom <= b2.y - b2.top ||
      b1.y - b1.top >= b2.y + b2.bottom
    )
      return false;
    return true;
  }
  static colliding_arr(b1: IBox, arr: IBox[]): IBox {
    for (let i = arr.length; i--; ) {
      let elem = arr[i];
      if (this.is_colliding(elem, b1)) return elem;
    }
    return null;
  }
}
//#endregion

//#region InputManager
class InputData {
  isDown: boolean = false;
  up: boolean = false;
  down: boolean = false;
  update(b: boolean) {
    if (b !== this.isDown) {
      if (this.isDown) this.up = true;
      else this.down = true;
    } else {
      this.down = false;
      this.up = false;
    }
    this.isDown = b;
  }
}
class GamepadData
{
  buttons:Map<number,InputData> = new Map();
  axes:number[] = [];
  constructor(gamepad:Gamepad)
  {
    for (let i = gamepad.buttons.length; i--;)
      this.buttons.set(i,new InputData());
    this.axes.length = gamepad.axes.length;
  }
  update(gamepad:Gamepad)
  {
    let axes = gamepad.axes;
    this.buttons.forEach((button,i) =>{ button.update(gamepad.buttons[i].pressed);});
    for (let i = axes.length; i--;)
      this.axes[i] = axes[i];
  }
}
class GamepadEvents
{
  disconnect: Map<number,(index:number) => void> = new Map();
  connect: Map<number,(gamepad:GamepadData) => void> = new Map();
  add_connect(func:(gamepad:GamepadData) => void)
  {
    let i = 0;
    while (true)
    {
      if (!this.connect.has(i))
      {
        this.connect.set(i,func);
        return i;
      }
    }
  }
  remove_connect(index:number)
  {
    this.connect.delete(index);
  }
  add_disconnect(func:(index:number) => void)
  {
    let i = 0;
    while (true)
    {
      if (!this.disconnect.has(i))
      {
        this.disconnect.set(i,func);
        return i;
      }
    }
  }
  remove_disconnect(index:number)
  {
    this.disconnect.delete(index);
  }
}
class InputManager {
  keys:Map<string,InputData> = null;
  gamepads:Map<number,GamepadData> = null;
  gamepad_events = new GamepadEvents();
  on(event:string,func:() => any)
  {
    if (!func)
      throw new Error('A callback function must be provided as an argument.')
    if (event === 'gamepad_connect')
    {
      let index = this.gamepad_events.add_connect(func);
      return () => this.gamepad_events.remove_connect(index);
    }
    else if ('gamepad_disconnect')
    {
      let index = this.gamepad_events.add_disconnect(func);
      return () => this.gamepad_events.remove_disconnect(index);
    }
    else
      throw new Error('Invalid event string.');
  }
  gamepad_handler(event:GamepadEvent,connecting:boolean)
  {
    let gamepad = event.gamepad;
    if (connecting)
    {
      let gamepad_data:GamepadData = this.add_gamepad(gamepad);
      this.gamepad_events.connect.forEach(func => func(gamepad_data));
    }
    else
    {
      let index = gamepad.index;
      this.gamepads.delete(index);
      this.gamepad_events.disconnect.forEach(func => func(index));
    }
  }
  add_keys(keys: string[] | string) {
    let map = this.keys;
    if (typeof keys === "string") map.set(keys, new InputData());
    else
      for (let i = keys.length; i--; ) {
        let key = keys[i];
        if (!map.has(key)) this.keys.set(key, new InputData());
      }
  }
  keydown(e: KeyboardEvent) {
    if (!e.repeat) this.keys.get(e.code)?.update(true);
  }
  keyup(e: KeyboardEvent) {
    if (!e.repeat) this.keys.get(e.code)?.update(false);
  }
  keyboard()
  {
    this.keys = new Map();
    document.addEventListener("keydown", this.keydown.bind(this));
    document.addEventListener("keyup", this.keyup.bind(this));
    if (this.gamepads === null)
      this.update = this.update_keyboard.bind(this);
    else
      this.update = this.update_both.bind(this);
  }
  gamepad()
  {
    this.gamepads = new Map();
    document.addEventListener("gamepadconnected", (e:GamepadEvent) => this.gamepad_handler(e,true),false);
    document.addEventListener("gamepaddisconnect", (e:GamepadEvent) => this.gamepad_handler(e,true),false);
    if (this.keys === null)
      this.update = this.update_gamepads.bind(this);
    else
      this.update = this.update_both.bind(this);
  }
  remove_key(key: string) {
    return this.keys.delete(key);
  }
  update_gamepads()
  {
    let gamepads = navigator.getGamepads ? navigator.getGamepads() : ((navigator as any).webkitGetGamepads ? (navigator as any).webitGetGamepads : []);
    for (let i = gamepads.length; i--;)
    {
      let gamepad = gamepads[i];
      if (gamepad)
      {
        if (this.gamepads.has(i))
          this.gamepads.get(i).update(gamepad);
        else
        {
          this.add_gamepad(gamepad);
          let gamepad_data = this.gamepads.get(gamepad.index);
          this.gamepad_events.connect.forEach((func,i) => func(gamepad_data));
        }
      }
    }
  }
  add_gamepad(gamepad:Gamepad)
  {
    let gamepad_data = new GamepadData(gamepad);
    this.gamepads.set(gamepad.index,gamepad_data);
    return gamepad_data;
  }
  update_keyboard()
  {
    this.keys.forEach(elem => elem.update(elem.isDown));
  }
  update_both()
  {
    this.update_keyboard();
    this.update_gamepads();
  }
  update() {}
}
//#endregion

//#region Physics
class Physics {
  static appr(val: number, target: number, amount: number) {
    return val > target
      ? Math.max(val - amount, target)
      : Math.min(val + amount, target);
  }
}
//#endregion

//#region SpriteManager
class SpriteManager {
  sprites = new Map();
  get(key: string) {
    return this.sprites.get(key);
  }
  add_sprite(key: string, src: string, cb: () => {}) {
    let image = new Image();
    image.onload = img => {
        (image as any).wd2 = image.width/2;
        (image as any).hd2 = image.height/2;
        this.sprites.set(key, image);
        cb();
    };
    image.onerror = () => {
      throw new Error("Unable to load sprite.");
    };
    image.src = src;
  }
  remove_sprite(key: string) {
    return this.sprites.delete(key);
  }
}
//#endregion

//#region Sprite
class Sprite extends Box {
  animation_manager: SpriteAnimationManager;
  scene: Scene;
  camera: Camera;
  flip: boolean = false;
  ctx: CanvasRenderingContext2D;
  constructor(configs: any) {
    super(configs.x, configs.y, configs.w, configs.h);
    this.scene = configs.scene;
    this.animation_manager = new SpriteAnimationManager({
      game: configs.scene.game,
      key: configs.key
    });
    this.ctx = configs.scene.game.ctx;
    this.camera = this.scene.game.camera;
  }
  draw(delta: number) {
    this.animation_manager.update(delta);
    if (this.camera.is_in_view(this))
    {
        let image = this.animation_manager.get();
        this.ctx.drawImage(
            image,
            this.x - image.wd2,
            this.y - image.height,
            image.width,
            image.height
        );
    }
  }
  update() {}
}
//#endregion

//#region Scene
class Scene {
  private load_count = 0;
  private load_quantity = 0;
  private draw_list: Map<number, Sprite> = new Map();
  key: string;
  game: Game;
  obstacles:IBox[] = [];
  constructor(configs: any) {
    this.game = configs.game;
    this.key = configs.key;
  }
  add(sprite: Sprite): Sprite {
    let draw_list = this.draw_list;
    let i = 0;
    while (true) {
      if (!draw_list.has(i)) {
        draw_list.set(i, sprite);
        return sprite;
      }
      i++;
    }
  }
  private load_end() {
    if (++this.load_count >= this.load_quantity) {
      this.create();
      this.game.start();
    }
  }
  public load_sprite(key: string, url: string) {
    this.load_quantity++;
    this.game.sprite_manager.add_sprite(key, url, this.load_end.bind(this));
  }
  load() {
    this.create();
  }
  create() {
    this.game.start();
  }
  update(delta:number){};
  draw(delta: number) {
    this.draw_list.forEach(sprite => sprite.draw(delta));
    let obstacles = this.obstacles;
    let ctx = this.game.ctx;
    ctx.fillStyle = "black";
    for (let i = obstacles.length; i--; ) {
      let obstacle = obstacles[i];
      ctx.fillRect(obstacle.x - obstacle.left, obstacle.y - obstacle.top, obstacle.w, obstacle.h);
    }
  }
}
//#endregion

//#region Game
class Game {
  raf_index: number;
  paused: boolean;
  last_time: number;
  scenes: any[] = [];
  active_scene: Scene = null;
  w = 500;
  h = 500;
  input_manager = new InputManager();
  sprite_manager = new SpriteManager();
  camera: Camera;
  public ctx;
  private canvas;
  constructor(configs: any) {
    let canvas = configs.canvas;
    if (!canvas) throw new Error("No canvas id provided.");
    canvas = document.getElementById(canvas);
    if (!canvas) throw new Error("Invalid canvas id.");
    this.ctx = canvas.getContext("2d");
    this.canvas = canvas;
    if (configs.size) {
      this.w = configs.size.width;
      this.h = configs.size.height;
    }
    this.ctx.canvas.width = this.w;
    this.ctx.canvas.height = this.h;
    this.camera = new Camera({
      x: 0,
      y: 0,
      w: this.w,
      h: this.h,
      game: this
    });
    if (!configs.scenes) throw new Error("No scenes provided to Game object.");
    if (typeof configs.scenes.length !== "number")
      this.scenes.push(configs.scenes);
    else this.scenes = configs.scenes;
    this.ctx.canvas.style.backgroundColor =
      configs.backgroundColor || "#00ffbb";
      if (configs.inputs)
      {
        if (configs.inputs.keyboard)
          this.input_manager.keyboard();
        if (configs.inputs.gamepad)
          this.input_manager.gamepad();
      }
    this.active_scene = new this.scenes[0](this);
    this.active_scene.load();
  }
  resize(width: number, height: number) {
    this.ctx.canvas.width = this.w = width;
    this.ctx.canvs.height = this.h = height;
  }
  set_scene(index: number) {
    this.stop();
    let scene = this.scenes[index];
    if (scene) 
    {
      this.active_scene = new scene(this);
      this.active_scene.load();
    }
    else throw new Error("Invalid scene index: " + index);
    
  }
  start() {
    this.last_time = Date.now();
    this.raf();
  }
  stop() {
    this.craf();
  }
  pause() {
    this.craf();
    this.paused = true;
  }
  resume() {
    this.raf();
    this.paused = true;
  }
  raf() {
    this.raf_index = requestAnimationFrame(this.update.bind(this));
  }
  craf() {
    cancelAnimationFrame(this.raf_index);
  }
  update() {
    let now = Date.now();
    let delta = (now - this.last_time) / 1000;
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.last_time = now;
    this.active_scene.update(delta);
    this.active_scene.draw(delta);
    this.input_manager.update();
    this.raf();
  }
}
//#endregion
