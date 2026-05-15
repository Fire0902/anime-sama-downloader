export default class FakeBar {
  private current = 0;
  private total = 60;

  update(v: number) {
    this.current = v;
  }

  stop() {}

  getTotal() {
    return this.total;
  }

  getCurrent() {
    return this.current;
  }
}
