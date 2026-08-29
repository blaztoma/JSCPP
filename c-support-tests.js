// C support: elaborated struct types, the malloc family, and the stdio readers
// a C course actually teaches. Expected output is written beside each program
// and worked out by hand, never captured from a run.
const J = require('./lib/launcher.js').default;

const run = (code, input = '') => new Promise((res) => {
  let out = '', done = false, fed = false;
  const fin = (err) => { if (!done) { done = true; res({ out, err: err || null }); } };
  try {
    J.run(code, () => (fed ? '' : ((fed = true), input)), {
      stdio: { write: (s) => { out += s; }, finishCallback: () => fin(), promiseError: (m) => fin(String(m)) },
      maxTimeout: 5000,
    });
  } catch (e) { fin(String(e.message || e)); }
  setTimeout(() => fin('timed out'), 6000);
});

const C = (body, headers = '#include <stdio.h>') => `${headers}\n${body}`;

const CASES = [
  // ── the elaborated type specifier, which is not optional in C ──────────────
  ['struct tag as a type', C(`struct Point { int x; int y; };
int main(){ struct Point p; p.x = 3; p.y = 4; printf("%d %d\\n", p.x, p.y); return 0; }`), '', '3 4\n'],

  ['struct tag through a pointer', C(`struct Account { int balance; };
void deposit(struct Account *a, int amount){ a->balance += amount; }
int main(){ struct Account a; a.balance = 100; deposit(&a, 250); printf("%d\\n", a.balance); return 0; }`), '', '350\n'],

  ['struct returned by value', C(`struct Point { int x; int y; };
struct Point make(int x, int y){ struct Point p; p.x = x; p.y = y; return p; }
int main(){ struct Point p = make(2, 7); printf("%d %d\\n", p.x, p.y); return 0; }`), '', '2 7\n'],

  ['typedef struct with no tag', C(`typedef struct { char name[20]; int score; } Student;
int main(){ Student s; s.score = 68; printf("%d\\n", s.score); return 0; }`), '', '68\n'],

  ['typedef struct keeps the tag too', C(`typedef struct Node { int v; } Node;
int main(){ Node a; struct Node b; a.v = 1; b.v = 2; printf("%d%d\\n", a.v, b.v); return 0; }`), '', '12\n'],

  ['array of structs', C(`struct Student { int score; };
int main(){ struct Student roll[3];
  roll[0].score = 70; roll[1].score = 55; roll[2].score = 82;
  int total = 0; for (int i = 0; i < 3; i++) total += roll[i].score;
  printf("%d\\n", total); return 0; }`), '', '207\n'],   // 70+55+82

  // A self-referential struct is the first data structure every C course
  // builds, and `struct Node *next;` as a MEMBER reaches the grammar through a
  // different rule than a declaration or a cast does.
  ['self-referential struct, the C spelling', C(`struct Node { int v; struct Node *next; };
int main(){ struct Node a, b; a.v = 1; b.v = 2; a.next = &b; b.next = 0;
  printf("%d %d\\n", a.v, a.next->v); return 0; }`), '', '1 2\n'],

  ['a struct held inside another struct', C(`struct Point { int x; int y; };
struct Shape { int id; struct Point origin; };
int main(){ struct Shape s; s.id = 7; s.origin.x = 3; s.origin.y = 4;
  printf("%d %d %d\\n", s.id, s.origin.x, s.origin.y); return 0; }`), '', '7 3 4\n'],

  ['a linked list built on the heap', C(`struct Node { int v; struct Node *next; };
int main(){ struct Node *head = 0;
  for (int i = 3; i >= 1; i--) {
    struct Node *n = malloc(sizeof(struct Node));
    n->v = i; n->next = head; head = n;
  }
  for (struct Node *p = head; p != 0; p = p->next) printf("%d ", p->v);
  printf("\\n"); return 0; }`,
    '#include <stdio.h>\n#include <stdlib.h>'), '', '1 2 3 \n'],

  // ── the heap ───────────────────────────────────────────────────────────────
  ['malloc cuts the block to the type', C(`int main(){ int *p = malloc(3 * sizeof(int));
  p[0] = 7; p[1] = 8; p[2] = 9;
  printf("%d %d %d\\n", p[0], p[1], p[2]); free(p); return 0; }`,
    '#include <stdio.h>\n#include <stdlib.h>'), '', '7 8 9\n'],

  ['malloc of double', C(`int main(){ double *d = malloc(2 * sizeof(double));
  d[0] = 1.5; d[1] = 2.25; printf("%.2f\\n", d[0] + d[1]); free(d); return 0; }`,
    '#include <stdio.h>\n#include <stdlib.h>'), '', '3.75\n'],

  ['calloc zeroes', C(`int main(){ int *p = calloc(4, sizeof(int));
  p[3] = 42; printf("%d %d %d\\n", p[0], p[2], p[3]); free(p); return 0; }`,
    '#include <stdio.h>\n#include <stdlib.h>'), '', '0 0 42\n'],

  ['malloc then loop over it', C(`int main(){ int n = 5; int *a = malloc(n * sizeof(int));
  for (int i = 0; i < n; i++) a[i] = i * i;
  for (int i = 0; i < n; i++) printf("%d ", a[i]);
  printf("\\n"); free(a); return 0; }`,
    '#include <stdio.h>\n#include <stdlib.h>'), '', '0 1 4 9 16 \n'],

  // sizeof reaches the type through a different grammar rule than a declaration
  // does, so the elaborated form has to be accepted in both — this is malloc's
  // own idiom and it is how the browser caught the half-done version.
  ['sizeof an elaborated struct', C(`struct Student { char name[20]; int score; };
int main(){ int n = 2; struct Student *roll = malloc(n * sizeof(struct Student));
  roll[0].score = 70; roll[1].score = 80;
  printf("%d\\n", roll[0].score + roll[1].score); free(roll); return 0; }`,
    '#include <stdio.h>\n#include <stdlib.h>'), '', '150\n'],

  // The cast form textbooks teach, and the void* round trip underneath it.
  ['the cast form of malloc', C(`struct Point { int x; };
int main(){ struct Point *p = (struct Point *) malloc(sizeof(struct Point));
  p->x = 11; printf("%d\\n", p->x); free(p); return 0; }`,
    '#include <stdio.h>\n#include <stdlib.h>'), '', '11\n'],

  // Parking a block in a `void *` variable before casting it is NOT supported:
  // the declaration succeeds and the initialisation does not, because a void
  // pointer variable cannot hold the untyped block. Both forms a course teaches
  // — assigning malloc straight to the typed pointer, and the cast above it —
  // work, so this stays a documented limit rather than a fix.
  ['a void pointer variable still declares', C(`int main(){ void *p; printf("ok\\n"); return 0; }`,
    '#include <stdio.h>\n#include <stdlib.h>'), '', 'ok\n'],

  // ── reading input, which is what the Input panel promises ──────────────────
  ['scanf two integers', C(`int main(){ int a, b; scanf("%d %d", &a, &b); printf("%d\\n", a * b); return 0; }`),
    '6 7\n', '42\n'],

  ['scanf a word', C(`int main(){ char n[30]; scanf("%s", n); printf("hello %s\\n", n); return 0; }`),
    'Adaeze\n', 'hello Adaeze\n'],

  ['gets drops the newline', C(`int main(){ char line[60]; gets(line); printf("[%s]\\n", line); return 0; }`),
    'Chidi Nwosu\n', '[Chidi Nwosu]\n'],

  ['fgets keeps the newline', C(`int main(){ char line[60]; fgets(line, 60, stdin); printf("[%s]", line); return 0; }`),
    'Chidi Nwosu\n', '[Chidi Nwosu\n]'],

  // size 5 takes four characters and no newline, because the line did not end;
  // the rest stays in the stream, so the next fgets continues from it.
  ['fgets truncates and leaves the rest', C(`int main(){ char a[5], b[5];
  fgets(a, 5, stdin); fgets(b, 5, stdin); printf("[%s][%s]", a, b); return 0; }`),
    'abcdefgh\n', '[abcd][efgh]'],

  // strcpy and sprintf wrote plain values into the destination, so the buffer
  // came back unassignable: `strcpy(buf, "x"); buf[0] = 'y';` — ordinary C —
  // failed with "is not a left value". gets and fgets wrote the same way.
  ['a buffer stays writable after strcpy', C(`int main(){ char b[16]; strcpy(b, "Lovelace");
  b[0] = 'l'; printf("%s\\n", b); return 0; }`,
    '#include <stdio.h>\n#include <string.h>'), '', 'lovelace\n'],

  ['reverse in place after strcpy', C(`void rev(char *s){ int n = strlen(s);
  for (int i = 0; i < n / 2; i++) { char t = s[i]; s[i] = s[n-1-i]; s[n-1-i] = t; } }
int main(){ char b[16]; strcpy(b, "Lovelace"); rev(b); printf("%s\\n", b); return 0; }`,
    '#include <stdio.h>\n#include <string.h>'), '', 'ecalevoL\n'],

  ['a buffer stays writable after sprintf', C(`int main(){ char b[16]; sprintf(b, "%d-%d", 4, 2);
  b[1] = '+'; printf("%s\\n", b); return 0; }`,
    '#include <stdio.h>\n#include <string.h>'), '', '4+2\n'],

  ['and after gets', C(`int main(){ char b[32]; gets(b); b[0] = 'X'; printf("%s\\n", b); return 0; }`),
    'ada\n', 'Xda\n'],

  // `while (*p)` and `for (; s[i]; )` are how C walks a string, and an array
  // element in a boolean context was ALWAYS false: the condition cast the
  // reference without capturing it first. A pointer condition crashed outright.
  ['a char array element is truthy', C(`int main(){ char s[8] = "abc";
  if (s[0]) printf("yes\\n"); else printf("no\\n"); return 0; }`), '', 'yes\n'],

  ['for (; s[i]; ) walks the string', C(`int main(){ char s[16] = "Lovelace"; int n = 0;
  for (int i = 0; s[i]; i++) n++; printf("%d\\n", n); return 0; }`), '', '8\n'],

  ['while (*p) walks it too', C(`int main(){ char s[16] = "Ada"; char *p = s; int n = 0;
  while (*p) { n++; p++; } printf("%d\\n", n); return 0; }`), '', '3\n'],

  ['a pointer is truthy, and null is not', C(`struct N { int v; };
int main(){ struct N a; struct N *p = &a; struct N *q = 0;
  printf("%s %s\\n", p ? "yes" : "no", q ? "yes" : "no"); return 0; }`), '', 'yes no\n'],

  ['while (p) walks a linked list', C(`struct N { int v; struct N *next; };
int main(){ struct N *head = 0;
  for (int i = 3; i >= 1; i--) { struct N *n = malloc(sizeof(struct N)); n->v = i; n->next = head; head = n; }
  int sum = 0; struct N *p = head;
  while (p) { sum += p->v; p = p->next; }
  printf("%d\\n", sum); return 0; }`,
    '#include <stdio.h>\n#include <stdlib.h>'), '', '6\n'],

  // `!visited[i]` is in every graph algorithm, and a unary operator resolved
  // against an UNCAPTURED array element — so `!` was always true. Dijkstra came
  // back with two nodes unreachable and nobody would have known why.
  ['! of an array element', C(`int main(){ int a[3] = {0, 1, 0}; int n = 0;
  for (int i = 0; i < 3; i++) if (!a[i]) n++; printf("%d\\n", n); return 0; }`), '', '2\n'],

  ['- and ~ of an array element', C(`int main(){ int a[2] = {5, 7};
  printf("%d %d\\n", -a[0], ~a[1]); return 0; }`), '', '-5 -8\n'],

  ['& and * still take the reference', C(`int main(){ int a[3] = {1, 2, 3};
  int *p = &a[1]; printf("%d %d\\n", *p, *a); return 0; }`), '', '2 1\n'],

  ['Dijkstra over a static matrix', C(`int main(){
  int g[6][6]; for (int i = 0; i < 6; i++) for (int j = 0; j < 6; j++) g[i][j] = 0;
  g[0][1]=7; g[0][2]=9; g[0][5]=14; g[1][2]=10; g[1][3]=15; g[2][3]=11; g[2][5]=2; g[3][4]=6; g[4][5]=9;
  for (int i = 0; i < 6; i++) for (int j = 0; j < 6; j++) if (g[i][j]) g[j][i] = g[i][j];
  int dist[6], seen[6];
  for (int i = 0; i < 6; i++) { dist[i] = 1000000; seen[i] = 0; }
  dist[0] = 0;
  for (int it = 0; it < 6; it++) {
    int u = -1;
    for (int i = 0; i < 6; i++) if (!seen[i] && (u < 0 || dist[i] < dist[u])) u = i;
    seen[u] = 1;
    for (int v = 0; v < 6; v++) if (g[u][v] && dist[u] + g[u][v] < dist[v]) dist[v] = dist[u] + g[u][v];
  }
  for (int i = 0; i < 6; i++) printf("%d ", dist[i]);
  printf("\\n"); return 0; }`), '', '0 7 9 20 20 11 \n'],

  // `while (scanf("%d", &n) == 1)` is how C reads until end of input, and the
  // last read raised "Memory overflow" instead of returning a short count.
  ['scanf in a loop to end of input', C(`int main(){ int n, count = 0, sum = 0;
  while (scanf("%d", &n) == 1) { count++; sum += n; }
  printf("%d %d\\n", count, sum); return 0; }`), '4\n5\n6\n', '3 15\n'],

  ['scanf returns how many it filled', C(`int main(){ int a, b;
  int r = scanf("%d %d", &a, &b);
  printf("r=%d a=%d\\n", r, a); return 0; }`), '5\n', 'r=1 a=5\n'],

  // ── the plain C that already worked, so a regression is visible ────────────
  ['string.h', C(`int main(){ char a[40] = "Ada"; char b[10] = " Lovelace";
  strcat(a, b); printf("%s %d\\n", a, (int)strlen(a)); return 0; }`,
    '#include <stdio.h>\n#include <string.h>'), '', 'Ada Lovelace 12\n'],  // "Ada Lovelace" is 12 chars

  ['math.h', C(`int main(){ printf("%.4f %.0f %.0f\\n", sqrt(2.0), pow(2, 10), floor(3.9)); return 0; }`,
    '#include <stdio.h>\n#include <math.h>'), '', '1.4142 1024 3\n'],

  ['recursion', C(`int fact(int n){ return n <= 1 ? 1 : n * fact(n - 1); }
int main(){ printf("%d\\n", fact(10)); return 0; }`), '', '3628800\n'],   // 10!

  ['2D array with width specifiers', C(`int main(){ double m[2][2] = {{1.5, 2.25}, {3.0, 4.125}};
  for (int i = 0; i < 2; i++){ for (int j = 0; j < 2; j++) printf("%7.3f", m[i][j]); printf("\\n"); }
  return 0; }`), '', '  1.500  2.250\n  3.000  4.125\n'],

  // ── C++ must not have regressed ────────────────────────────────────────────
  ['C++ cin still reads', `#include <iostream>
using namespace std;
int main(){ int a, b; cin >> a >> b; cout << a + b << endl; return 0; }`, '4 6\n', null],

  ['C++ classes still work', `#include <iostream>
using namespace std;
class S { public: int v; S(int x) : v(x) { } int twice(){ return v * 2; } };
int main(){ S s(21); cout << s.twice() << endl; return 0; }`, '', '42\n'],

  ['C++ vector of strings still works', `#include <iostream>
#include <vector>
#include <string>
using namespace std;
int main(){ vector<string> v; v.push_back("Ada"); v.push_back("Chidi");
  for (int i = 0; i < v.size(); i++) cout << v[i] << endl; return 0; }`, '', 'Ada\nChidi\n'],

  ['C++ new/delete still works', `#include <iostream>
using namespace std;
int main(){ int *p = new int[3]; p[0]=1; p[1]=2; p[2]=3;
  int t = 0; for (int i = 0; i < 3; i++) t += p[i]; cout << t << endl; delete[] p; return 0; }`, '', '6\n'],

  ['printf and cout in one program', `#include <cstdio>
#include <iostream>
int main(){ printf("a%d\\n", 1); std::cout << "b2" << std::endl; return 0; }`, '', 'a1\nb2\n'],
];

(async () => {
  let pass = 0, fail = 0;
  for (const [name, code, input, want] of CASES) {
    const r = await run(code, input);
    const ok = !r.err && (want === null || r.out === want);
    if (ok) { pass++; console.log(`  PASS  ${name}`); }
    else {
      fail++;
      console.log(`  FAIL  ${name}`);
      console.log(`          got  ${JSON.stringify(r.err ? 'ERROR: ' + r.err : r.out)}`);
      if (want !== null) console.log(`          want ${JSON.stringify(want)}`);
    }
  }
  console.log(`\n  ${pass} pass / ${fail} fail  (of ${CASES.length})\n`);
  process.exit(fail ? 1 : 0);
})();
