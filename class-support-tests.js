// The single source of truth: regressions + fixed bugs + expansions.
// Async runner: the launcher steps through the event loop for input-using
// programs, so completion is awaited via stdio.finishCallback rather than
// assumed at return — the old sync harness read output too early and
// reported a false failure on every cin program.
const J = require('./lib/launcher.js').default;

const CASES = [
// ── original regressions ──
["hello",`#include <iostream>
using namespace std;
int main(){ cout<<"hi"<<endl; return 0; }`,"","hi"],
["cin arithmetic",`#include <iostream>
using namespace std;
int main(){ int a,b; cin>>a>>b; cout<<a+b<<endl; return 0; }`,"7 5\n","12"],
["array max",`#include <iostream>
using namespace std;
int main(){ int a[5]={4,1,9,2,7},m=a[0];
for(int i=1;i<5;i++) if(a[i]>m) m=a[i];
cout<<m<<endl; return 0; }`,"","9"],
["recursion",`#include <iostream>
using namespace std;
int f(int n){ return n<=1?1:n*f(n-1); }
int main(){ cout<<f(6)<<endl; return 0; }`,"","720"],
["pointers swap",`#include <iostream>
using namespace std;
void sw(int*x,int*y){int t=*x;*x=*y;*y=t;}
int main(){int a=3,b=8; sw(&a,&b); cout<<a<<","<<b<<endl; return 0;}`,"","8,3"],
["struct",`#include <iostream>
using namespace std;
struct S { int id; };
int main(){ S s; s.id=42; cout<<s.id<<endl; return 0; }`,"","42"],
["string",`#include <iostream>
#include <string>
using namespace std;
int main(){ string s="Ada"; cout<<s<<s.length()<<endl; return 0; }`,"","Ada3"],
["vector",`#include <iostream>
#include <vector>
using namespace std;
int main(){ vector<int> v; v.push_back(3); v.push_back(9);
cout<<v[1]<<v.size()<<endl; return 0; }`,"","92"],
["sort",`#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;
int main(){ vector<int> v; v.push_back(5); v.push_back(1); v.push_back(3);
sort(v.begin(),v.end());
for(int i=0;i<v.size();i++) cout<<v[i];
cout<<endl; return 0; }`,"","135"],
["struct array",`#include <iostream>
using namespace std;
struct R { int m; };
int main(){ R r[2]; r[0].m=70; r[1].m=90;
cout<<(r[0].m+r[1].m)/2<<endl; return 0; }`,"","80"],
["2d array",`#include <iostream>
using namespace std;
int main(){ int m[2][2]={{1,2},{3,4}}; int t=0;
for(int i=0;i<2;i++) for(int j=0;j<2;j++) t+=m[i][j];
cout<<t<<endl; return 0; }`,"","10"],
["while + break",`#include <iostream>
using namespace std;
int main(){ int i=0,s=0; while(true){ if(i>=5) break; s+=i; i++; }
cout<<s<<endl; return 0; }`,"","10"],
// ── classes (previous session) ──
["CLASS basic",`#include <iostream>
using namespace std;
class C { public: int n; };
int main(){ C c; c.n=7; cout<<c.n<<endl; return 0; }`,"","7"],
["CLASS method mutates instance",`#include <iostream>
using namespace std;
class Counter { public: int n; void inc() { n = n + 1; } int get() { return n; } };
int main(){ Counter c; c.n=10; c.inc(); c.inc(); c.inc(); cout<<c.get()<<endl; return 0; }`,"","13"],
["CLASS private + method",`#include <iostream>
using namespace std;
class Box { private: int w; public: void set(int x) { w = x; } int area() { return w * w; } };
int main(){ Box b; b.set(4); cout<<b.area()<<endl; return 0; }`,"","16"],
["METHOD calls sibling",`#include <iostream>
using namespace std;
class C { public: int n; void inc(){ n=n+1; } void twice(){ inc(); inc(); } int get(){ return n; } };
int main(){ C c; c.n=0; c.twice(); cout<<c.get()<<endl; return 0; }`,"","2"],
["CLASS in vector",`#include <iostream>
#include <vector>
using namespace std;
class C { public: int n; };
int main(){ vector<C> v; C a; a.n=7; v.push_back(a); cout<<v[0].n<<endl; return 0; }`,"","7"],
["CTOR with args",`#include <iostream>
#include <string>
using namespace std;
class Student { private: string name; int score;
 public: Student(string n,int s){ name=n; score=s; }
 void show(){ cout<<name<<":"<<score<<endl; } };
int main(){ Student a("Ada",88); a.show(); return 0; }`,"","Ada:88"],
["CTOR default",`#include <iostream>
using namespace std;
class C { public: int n; C(){ n=5; } int get(){ return n; } };
int main(){ C c; cout<<c.get()<<endl; return 0; }`,"","5"],
["NEW single (user class)",`#include <iostream>
using namespace std;
class C { public: int n; };
int main(){ C* p = new C; p[0].n=77; cout<<p[0].n<<endl; delete p; return 0; }`,"","77"],
["NEW array",`#include <iostream>
using namespace std;
int main(){ int* a = new int[3]; a[0]=1;a[1]=2;a[2]=3;
int s=0; for(int i=0;i<3;i++) s+=a[i];
delete[] a; cout<<s<<endl; return 0; }`,"","6"],
// ── this session: bug fixes ──
["OVERLOAD int picks int",`#include <iostream>
using namespace std;
int add(int a,int b){ return a+b; }
double add(double a,double b){ return a+b; }
int main(){ cout<<add(2,3)<<endl; return 0; }`,"","5"],
["OVERLOAD double picks double",`#include <iostream>
using namespace std;
int add(int a,int b){ return a+b; }
double add(double a,double b){ return a+b; }
int main(){ cout<<add(1.5,2.25)<<endl; return 0; }`,"","3.75"],
["CTOR overload by TYPE",`#include <iostream>
using namespace std;
class C { public: int k; C(int x){ k=1; } C(double x){ k=2; } };
int main(){ C a(5); C b(1.5); cout<<a.k<<b.k<<endl; return 0; }`,"","12"],
["CTOR overload by arity",`#include <iostream>
using namespace std;
class C { public: int k; C(){ k=7; } C(int a,int b){ k=a+b; } };
int main(){ C x; C y(3,4); cout<<x.k<<y.k<<endl; return 0; }`,"","77"],
// ── this session: expansions ──
["ARROW on new-pointer",`#include <iostream>
using namespace std;
class C { public: int n; };
int main(){ C* p = new C; p->n = 9; p->n = p->n + 1; cout<<p->n<<endl; return 0; }`,"","10"],
["ARROW method call",`#include <iostream>
using namespace std;
class C { public: int n; void set(int x){ n=x; } int get(){ return n; } };
int main(){ C* p = new C; p->set(21); cout<<p->get()<<endl; return 0; }`,"","21"],
["ARROW on address-of",`#include <iostream>
using namespace std;
struct S { int v; };
int main(){ S s; S* p = &s; p->v = 5; cout<<s.v<<endl; return 0; }`,"","5"],
["THIS disambiguates",`#include <iostream>
using namespace std;
class C { public: int n; void set(int n2){ this->n = n2; } };
int main(){ C c; c.set(4); cout<<c.n<<endl; return 0; }`,"","4"],
["THIS in ctor",`#include <iostream>
using namespace std;
class C { public: int n; C(int x){ this->n = x * 2; } };
int main(){ C c(8); cout<<c.n<<endl; return 0; }`,"","16"],
["CONST method",`#include <iostream>
using namespace std;
class C { public: int n; int get() const { return n; } };
int main(){ C c; c.n=3; cout<<c.get()<<endl; return 0; }`,"","3"],
["CTOR init list",`#include <iostream>
using namespace std;
class C { public: int n; C(int x) : n(x) { } };
int main(){ C c(6); cout<<c.n<<endl; return 0; }`,"","6"],
["CTOR init list + body",`#include <iostream>
#include <string>
using namespace std;
class Student { public: string name; int score;
  Student(string n, int s) : name(n), score(s) { score = score + 1; } };
int main(){ Student a("Ada", 88); cout<<a.name<<":"<<a.score<<endl; return 0; }`,"","Ada:89"],
["DEFAULT member init",`#include <iostream>
using namespace std;
class C { public: int n = 42; };
int main(){ C c; cout<<c.n<<endl; return 0; }`,"","42"],
["INHERIT fields + methods",`#include <iostream>
using namespace std;
class A { public: int x; void setx(int v){ x=v; } };
class B : public A { public: int y; };
int main(){ B b; b.setx(3); b.y=4; cout<<b.x<<b.y<<endl; return 0; }`,"","34"],
["INHERIT struct base",`#include <iostream>
using namespace std;
struct P { int a; };
struct Q : public P { int b; };
int main(){ Q q; q.a=1; q.b=2; cout<<q.a<<q.b<<endl; return 0; }`,"","12"],
["OVERRIDE",`#include <iostream>
using namespace std;
class A { public: int id(){ return 1; } };
class B : public A { public: int id(){ return 2; } };
int main(){ A a; B b; cout<<a.id()<<b.id()<<endl; return 0; }`,"","12"],
["INHERITED method, base field",`#include <iostream>
using namespace std;
class A { public: int x; int doubled(){ return x*2; } };
class B : public A { public: int y; };
int main(){ B b; b.x=5; cout<<b.doubled()<<endl; return 0; }`,"","10"],
["DERIVED calls base method",`#include <iostream>
using namespace std;
class A { public: int base(){ return 10; } };
class B : public A { public: int plus(){ return base()+5; } };
int main(){ B b; cout<<b.plus()<<endl; return 0; }`,"","15"],
["INHERITED default init",`#include <iostream>
using namespace std;
class A { public: int x = 7; };
class B : public A { public: int y = 1; };
int main(){ B b; cout<<b.x<<b.y<<endl; return 0; }`,"","71"],
["THREE-level chain",`#include <iostream>
using namespace std;
class A { public: int a(){ return 1; } };
class B : public A { public: int b(){ return 2; } };
class C : public B { public: int c(){ return 3; } };
int main(){ C x; cout<<x.a()<<x.b()<<x.c()<<endl; return 0; }`,"","123"],
// ── null pointers, self-reference, temporaries ──
["NULL assign + compare",`#include <iostream>
using namespace std;
int main(){ int* p = NULL; if (p == NULL) cout<<"null"<<endl; return 0; }`,"","null"],
["nullptr",`#include <iostream>
using namespace std;
int main(){ int* p = nullptr; if (p == nullptr) cout<<"null"<<endl; return 0; }`,"","null"],
["non-null compare",`#include <iostream>
using namespace std;
int main(){ int* p = new int; if (p != NULL) cout<<"live"<<endl; return 0; }`,"","live"],
["SELF-REFERENTIAL struct",`#include <iostream>
using namespace std;
struct Node { int value; Node* next; };
int main(){ Node a; a.value=1; a.next=NULL; cout<<a.value<<endl; return 0; }`,"","1"],
["LINKED LIST traversal",`#include <iostream>
using namespace std;
struct Node { int value; Node* next; };
int main(){
  Node* head = new Node; head->value = 1;
  head->next = new Node; head->next->value = 2;
  head->next->next = new Node; head->next->next->value = 3;
  head->next->next->next = NULL;
  int sum = 0; Node* cur = head;
  while (cur != NULL) { sum = sum + cur->value; cur = cur->next; }
  cout<<sum<<endl; return 0; }`,"","6"],
["TEMPORARY into vector",`#include <iostream>
#include <vector>
#include <string>
using namespace std;
class Student { public: string name; int score;
  Student(string n, int s) : name(n), score(s) { } };
int main(){ vector<Student> v; v.push_back(Student("Ada", 88));
 cout<<v[0].name<<v[0].score<<endl; return 0; }`,"","Ada88"],
["BASE ctor chained",`#include <iostream>
using namespace std;
class Base { public: int a; Base() : a(1) { } };
class Derived : public Base { public: int b; Derived() : b(2) { } };
int main(){ Derived d; cout<<d.a<<","<<d.b<<endl; return 0; }`,"","1,2"],
["BASE ctor chained 3 levels",`#include <iostream>
using namespace std;
class A { public: int a; A() : a(1) { } };
class B : public A { public: int b; B() : b(2) { } };
class C : public B { public: int c; C() : c(3) { } };
int main(){ C x; cout<<x.a<<x.b<<x.c<<endl; return 0; }`,"","123"],
["BASE ctor with no derived ctor",`#include <iostream>
using namespace std;
class Base { public: int a; Base() : a(9) { } };
class Derived : public Base { public: int b; };
int main(){ Derived d; cout<<d.a<<endl; return 0; }`,"","9"],
];

function runCase(code, input) {
  return new Promise((resolve) => {
    let out = "", err = null, settled = false;
    const finish = () => { if (!settled) { settled = true; resolve({ out, err }); } };
    let fed = false;
    const feed = () => { if (fed) return ""; fed = true; return input; };
    try {
      J.run(code, feed, { stdio: {
        write: (s) => { out += s; },
        finishCallback: () => finish(),
        promiseError: (m) => { err = String(m); finish(); },
      } });
    } catch (e) { err = String(e.message || e); finish(); }
    setTimeout(finish, 3000); // guard: a hung program is a failure, not a wait
  });
}

(async () => {
  let pass = 0, fail = 0;
  for (const [name, code, input, expected] of CASES) {
    const { out, err } = await runCase(code, input);
    let got = out.trim();
    // The launcher echoes consumed stdin into the output stream, terminal
    // style. That is display behaviour, not program output — strip the echo
    // before comparing.
    if (input && got.startsWith(input.trim())) {
      got = got.slice(input.trim().length).trim();
    }
    if (err == null && got === expected) { pass++; console.log(`  PASS  ${name}`); }
    else {
      fail++;
      console.log(`  FAIL  ${name}  ->  ${err ? err.split("\n")[0].slice(0, 70) : `got ${JSON.stringify(got)} want ${JSON.stringify(expected)}`}`);
    }
  }
  console.log(`\n  ${pass} pass / ${fail} fail  (of ${CASES.length})`);
  process.exit(fail ? 1 : 0);
})();
